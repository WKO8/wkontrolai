/**
 * WKontrolAI — Testes Unitários de Schemas Zod e Validações em Runtime
 * Abrange: Contratos de Transações, Webhooks da Evolution API, Confirmações e Patches
 */

import { describe, it, expect } from 'vitest';
import {
  transactionTypeSchema,
  paymentMethodSchema,
  sourceChannelSchema,
  dateStringSchema,
  monetaryAmountSchema,
  extractedTransactionItemSchema,
  llmExtractionResponseSchema,
  confirmationActionTypeSchema,
  userConfirmationPatchSchema,
  parsedConfirmationIntentSchema,
  createTransactionSchema,
  updateTransactionSchema,
  transactionFilterQuerySchema,
  createCategorySchema,
  submitInsightFeedbackSchema,
} from '@/lib/validations/transaction';
import {
  evolutionWebhookPayloadSchema,
  evolutionMessageKeySchema,
  evolutionAudioMessageSchema,
  evolutionImageMessageSchema,
  whatsAppInboundJobDataSchema,
  evolutionSendTextPayloadSchema,
  whatsAppOtpVerificationSchema,
  whatsAppOtpGenerationSchema,
  type EvolutionMessageData,
} from '@/lib/validations/webhook';

describe('1. Schemas Básicos e Enums Financeiros', () => {
  it('transactionTypeSchema: deve aceitar EXPENSE e INCOME e rejeitar valores inválidos', () => {
    expect(transactionTypeSchema.parse('EXPENSE')).toBe('EXPENSE');
    expect(transactionTypeSchema.parse('INCOME')).toBe('INCOME');

    expect(() => transactionTypeSchema.parse('expense')).toThrow();
    expect(() => transactionTypeSchema.parse('TRANSFER')).toThrow();
    expect(() => transactionTypeSchema.parse('')).toThrow();
    expect(() => transactionTypeSchema.parse(null)).toThrow();
  });

  it('paymentMethodSchema: deve aceitar métodos válidos e rejeitar desconhecidos', () => {
    const validMethods = ['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'BANK_TRANSFER', 'OTHER'];
    for (const method of validMethods) {
      expect(paymentMethodSchema.parse(method)).toBe(method);
    }

    expect(() => paymentMethodSchema.parse('CHEQUE')).toThrow();
    expect(() => paymentMethodSchema.parse('CRYPTO')).toThrow();
    expect(() => paymentMethodSchema.parse('pix')).toThrow();
  });

  it('sourceChannelSchema: deve validar canais de entrada do sistema', () => {
    const validChannels = [
      'WHATSAPP_AUDIO',
      'WHATSAPP_TEXT',
      'WHATSAPP_IMAGE',
      'WEB_DASHBOARD',
    ];
    for (const channel of validChannels) {
      expect(sourceChannelSchema.parse(channel)).toBe(channel);
    }

    expect(() => sourceChannelSchema.parse('TELEGRAM')).toThrow();
    expect(() => sourceChannelSchema.parse('API')).toThrow();
  });

  it('dateStringSchema: deve validar estritamente o formato ISO YYYY-MM-DD', () => {
    expect(dateStringSchema.parse('2026-10-23')).toBe('2026-10-23');
    expect(dateStringSchema.parse('2025-01-01')).toBe('2025-01-01');

    expect(() => dateStringSchema.parse('23/10/2026')).toThrow();
    expect(() => dateStringSchema.parse('2026-1-1')).toThrow();
    expect(() => dateStringSchema.parse('2026-10-23T14:30:00Z')).toThrow();
    expect(() => dateStringSchema.parse('ontem')).toThrow();
    expect(() => dateStringSchema.parse('')).toThrow();
  });

  it('monetaryAmountSchema: deve normalizar casas decimais e rejeitar valores <= 0 ou exorbitantes', () => {
    expect(monetaryAmountSchema.parse(45)).toBe(45);
    expect(monetaryAmountSchema.parse(1250.5)).toBe(1250.5);
    expect(monetaryAmountSchema.parse(38.994)).toBe(38.99);
    expect(monetaryAmountSchema.parse(38.996)).toBe(39);
    expect(monetaryAmountSchema.parse(0.01)).toBe(0.01);

    expect(() => monetaryAmountSchema.parse(0)).toThrow();
    expect(() => monetaryAmountSchema.parse(-15.5)).toThrow();
    expect(() => monetaryAmountSchema.parse('50' as unknown as number)).toThrow();
    expect(() => monetaryAmountSchema.parse(10_000_001)).toThrow(); // Excede limite máximo
  });
});

describe('2. Schemas de Extração da IA (DeepSeek / Multimodal)', () => {
  it('extractedTransactionItemSchema: deve validar um item extraído completo', () => {
    const validItem = {
      amount: 54.9,
      type: 'EXPENSE',
      suggested_category: 'Transporte',
      payment_method: 'CREDIT_CARD',
      description: 'Gasolina Posto Shell',
      transaction_date: '2026-10-23',
      confidence_score: 0.95,
    };

    const parsed = extractedTransactionItemSchema.parse(validItem);
    expect(parsed.amount).toBe(54.9);
    expect(parsed.payment_method).toBe('CREDIT_CARD');
    expect(parsed.description).toBe('Gasolina Posto Shell');
  });

  it('extractedTransactionItemSchema: deve aplicar default "OTHER" para payment_method', () => {
    const itemWithoutPayment = {
      amount: 40,
      type: 'EXPENSE',
      suggested_category: 'Alimentação',
      description: 'Almoço no quilo',
      transaction_date: '2026-10-23',
    };

    const parsed = extractedTransactionItemSchema.parse(itemWithoutPayment);
    expect(parsed.payment_method).toBe('OTHER');
  });

  it('extractedTransactionItemSchema: deve rejeitar descrição vazia ou data malformatada', () => {
    expect(() =>
      extractedTransactionItemSchema.parse({
        amount: 20,
        type: 'EXPENSE',
        suggested_category: 'Alimentação',
        description: '', // Descrição vazia
        transaction_date: '2026-10-23',
      })
    ).toThrow();

    expect(() =>
      extractedTransactionItemSchema.parse({
        amount: 20,
        type: 'EXPENSE',
        suggested_category: 'Alimentação',
        description: 'Café',
        transaction_date: 'hoje', // Não é YYYY-MM-DD
      })
    ).toThrow();
  });

  it('llmExtractionResponseSchema: deve validar payload completo com sucesso', () => {
    const validResponse = {
      has_financial_intent: true,
      missing_information: null,
      transactions: [
        {
          amount: 30,
          type: 'EXPENSE',
          suggested_category: 'Transporte',
          payment_method: 'OTHER',
          description: 'Uber',
          transaction_date: '2026-10-23',
        },
        {
          amount: 45,
          type: 'EXPENSE',
          suggested_category: 'Alimentação',
          payment_method: 'DEBIT_CARD',
          description: 'Almoço',
          transaction_date: '2026-10-23',
        },
      ],
    };

    const parsed = llmExtractionResponseSchema.parse(validResponse);
    expect(parsed.has_financial_intent).toBe(true);
    expect(parsed.transactions).toHaveLength(2);
    expect(parsed.missing_information).toBeNull();
  });

  it('llmExtractionResponseSchema: deve aceitar payload de mensagem sem valor informado', () => {
    const incompleteResponse = {
      has_financial_intent: true,
      missing_information: 'Entendi que você abasteceu! Qual foi o valor gasto?',
      transactions: [],
    };

    const parsed = llmExtractionResponseSchema.parse(incompleteResponse);
    expect(parsed.has_financial_intent).toBe(true);
    expect(parsed.missing_information).toContain('Qual foi o valor');
    expect(parsed.transactions).toHaveLength(0);
  });

  it('llmExtractionResponseSchema: deve aceitar payload de mensagem não financeira', () => {
    const nonFinancialResponse = {
      has_financial_intent: false,
      missing_information: null,
      transactions: [],
    };

    const parsed = llmExtractionResponseSchema.parse(nonFinancialResponse);
    expect(parsed.has_financial_intent).toBe(false);
    expect(parsed.transactions).toHaveLength(0);
  });
});

describe('3. Schemas de Confirmação Interativa e Patching (Jev / WhatsApp)', () => {
  it('confirmationActionTypeSchema: deve validar todas as intenções de resposta', () => {
    const validActions = ['CONFIRM', 'CANCEL', 'PATCH', 'NEW_TRANSACTION', 'UNKNOWN'];
    for (const action of validActions) {
      expect(confirmationActionTypeSchema.parse(action)).toBe(action);
    }

    expect(() => confirmationActionTypeSchema.parse('DELETE')).toThrow();
    expect(() => confirmationActionTypeSchema.parse('OK')).toThrow();
  });

  it('userConfirmationPatchSchema: deve permitir atualizações parciais de campos', () => {
    // Apenas valor
    const patch1 = userConfirmationPatchSchema.parse({ amount: 60 });
    expect(patch1.amount).toBe(60);
    expect(patch1.category).toBeUndefined();

    // Apenas categoria e meio de pagamento
    const patch2 = userConfirmationPatchSchema.parse({
      category: 'Lazer',
      payment_method: 'PIX',
    });
    expect(patch2.category).toBe('Lazer');
    expect(patch2.payment_method).toBe('PIX');

    // Valida que dados inválidos no patch continuam sendo rejeitados
    expect(() => userConfirmationPatchSchema.parse({ amount: -10 })).toThrow();
    expect(() => userConfirmationPatchSchema.parse({ amount: 0 })).toThrow();
    expect(() => userConfirmationPatchSchema.parse({ transaction_date: 'ontem' })).toThrow();
  });

  it('parsedConfirmationIntentSchema: deve validar a intenção interpretada', () => {
    const parsed = parsedConfirmationIntentSchema.parse({
      action: 'PATCH',
      patch: { payment_method: 'PIX' },
      rawResponse: 'Muda pra Pix',
      reasoning: 'Usuário solicitou alteração do método de pagamento',
    });

    expect(parsed.action).toBe('PATCH');
    expect(parsed.patch?.payment_method).toBe('PIX');
  });

  it('parsedConfirmationIntentSchema: deve validar PATCH com alteração completa de campos (amount, type, category, payment_method, description, transaction_date)', () => {
    const fullPatch = parsedConfirmationIntentSchema.parse({
      action: 'PATCH',
      patch: {
        amount: 89.9,
        type: 'EXPENSE',
        category: 'Alimentação',
        payment_method: 'CREDIT_CARD',
        description: 'Jantar com clientes',
        transaction_date: '2026-10-25',
      },
      rawResponse: 'Altera o valor para 89.90 no cartão de crédito, categoria Alimentação',
      reasoning: 'Usuário enviou correções detalhadas dos campos',
    });

    expect(fullPatch.action).toBe('PATCH');
    expect(fullPatch.patch?.amount).toBe(89.9);
    expect(fullPatch.patch?.type).toBe('EXPENSE');
    expect(fullPatch.patch?.category).toBe('Alimentação');
    expect(fullPatch.patch?.payment_method).toBe('CREDIT_CARD');
    expect(fullPatch.patch?.description).toBe('Jantar com clientes');
    expect(fullPatch.patch?.transaction_date).toBe('2026-10-25');
  });

  it('parsedConfirmationIntentSchema: deve validar PATCH com removeItemIndex para remoção de item da lista pendente', () => {
    const removeFirstItem = parsedConfirmationIntentSchema.parse({
      action: 'PATCH',
      patch: {
        removeItemIndex: 0,
      },
      rawResponse: 'Remove o primeiro item',
      reasoning: 'Usuário solicitou exclusão do primeiro lançamento identificado',
    });

    expect(removeFirstItem.action).toBe('PATCH');
    expect(removeFirstItem.patch?.removeItemIndex).toBe(0);

    const removeSecondItem = parsedConfirmationIntentSchema.parse({
      action: 'PATCH',
      patch: {
        removeItemIndex: 1,
      },
      rawResponse: 'Tira o segundo gasto da lista',
      reasoning: 'Usuário pediu descarte do segundo item',
    });

    expect(removeSecondItem.patch?.removeItemIndex).toBe(1);
  });

  it('parsedConfirmationIntentSchema: deve validar intenções CONFIRM, CANCEL, NEW_TRANSACTION e UNKNOWN', () => {
    const confirm = parsedConfirmationIntentSchema.parse({
      action: 'CONFIRM',
      rawResponse: 'Sim, pode salvar',
    });
    expect(confirm.action).toBe('CONFIRM');

    const cancel = parsedConfirmationIntentSchema.parse({
      action: 'CANCEL',
      rawResponse: 'Não, cancela tudo',
    });
    expect(cancel.action).toBe('CANCEL');

    const newTx = parsedConfirmationIntentSchema.parse({
      action: 'NEW_TRANSACTION',
      rawResponse: 'Gastei 35 no uber agora',
    });
    expect(newTx.action).toBe('NEW_TRANSACTION');

    const unknown = parsedConfirmationIntentSchema.parse({
      action: 'UNKNOWN',
      rawResponse: 'Bom dia bot, tudo bem?',
    });
    expect(unknown.action).toBe('UNKNOWN');
  });
});

describe('4. Schemas de CRUD e Mutações no Dashboard (PWA)', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';

  it('createTransactionSchema: deve validar criação manual de transação', () => {
    const input = {
      amount: 150.0,
      type: 'EXPENSE',
      categoryId: validUuid,
      description: 'Supermercado Mensal',
      paymentMethod: 'CREDIT_CARD',
      transactionDate: '2026-10-23',
      sourceChannel: 'WEB_DASHBOARD',
    };

    const parsed = createTransactionSchema.parse(input);
    expect(parsed.amount).toBe(150.0);
    expect(parsed.categoryId).toBe(validUuid);
    expect(parsed.description).toBe('Supermercado Mensal');
  });

  it('createTransactionSchema: deve rejeitar descrição curta e UUID inválido', () => {
    expect(() =>
      createTransactionSchema.parse({
        amount: 50,
        type: 'EXPENSE',
        categoryId: 'not-a-uuid',
        description: 'Mercado',
        transactionDate: '2026-10-23',
      })
    ).toThrow(/UUID válido/);

    expect(() =>
      createTransactionSchema.parse({
        amount: 50,
        type: 'EXPENSE',
        categoryId: validUuid,
        description: 'A', // Menos de 2 caracteres
        transactionDate: '2026-10-23',
      })
    ).toThrow();
  });

  it('updateTransactionSchema: deve exigir UUID de ID da transação e permitir campos parciais', () => {
    const update = updateTransactionSchema.parse({
      id: validUuid,
      amount: 200,
    });
    expect(update.id).toBe(validUuid);
    expect(update.amount).toBe(200);

    expect(() => updateTransactionSchema.parse({ amount: 200 })).toThrow(); // ID obrigatório
  });

  it('updateTransactionSchema: deve rejeitar payload inválido (valor negativo, zero, UUID inválido)', () => {
    // Valor negativo
    expect(() =>
      updateTransactionSchema.parse({
        id: validUuid,
        amount: -50.25,
      })
    ).toThrow();

    // Valor zero
    expect(() =>
      updateTransactionSchema.parse({
        id: validUuid,
        amount: 0,
      })
    ).toThrow();

    // UUID inválido no id
    expect(() =>
      updateTransactionSchema.parse({
        id: 'not-a-valid-uuid',
        amount: 100,
      })
    ).toThrow();

    // UUID inválido no categoryId
    expect(() =>
      updateTransactionSchema.parse({
        id: validUuid,
        categoryId: 'not-a-valid-uuid',
      })
    ).toThrow();
  });

  it('updateTransactionSchema: deve aceitar atualização de descrição, valor, categoria, método de pagamento e data', () => {
    const validCategoryUuid = '220e8400-e29b-41d4-a716-446655440000';
    const parsed = updateTransactionSchema.parse({
      id: validUuid,
      description: 'Supermercado Mensal - Atualizado',
      amount: 320.75,
      categoryId: validCategoryUuid,
      paymentMethod: 'DEBIT_CARD',
      transactionDate: '2026-10-24',
    });

    expect(parsed.id).toBe(validUuid);
    expect(parsed.description).toBe('Supermercado Mensal - Atualizado');
    expect(parsed.amount).toBe(320.75);
    expect(parsed.categoryId).toBe(validCategoryUuid);
    expect(parsed.paymentMethod).toBe('DEBIT_CARD');
    expect(parsed.transactionDate).toBe('2026-10-24');
  });

  it('transactionFilterQuerySchema: deve preencher valores padrão de paginação e ordenação', () => {
    const query = transactionFilterQuerySchema.parse({});
    expect(query.page).toBe(1);
    expect(query.limit).toBe(20);
    expect(query.sortBy).toBe('transactionDate');
    expect(query.sortOrder).toBe('desc');
  });

  it('createCategorySchema: deve validar formato de cor hexadecimal e nome', () => {
    const cat = createCategorySchema.parse({
      name: 'Assinaturas',
      type: 'EXPENSE',
      color: '#10B981',
      icon: 'sparkles',
    });
    expect(cat.name).toBe('Assinaturas');
    expect(cat.color).toBe('#10B981');

    expect(() =>
      createCategorySchema.parse({
        name: 'A', // Muito curto
        type: 'EXPENSE',
      })
    ).toThrow();

    expect(() =>
      createCategorySchema.parse({
        name: 'Assinaturas',
        type: 'EXPENSE',
        color: 'verde', // Não é hex
      })
    ).toThrow();
  });

  it('submitInsightFeedbackSchema: deve validar feedback do usuário', () => {
    const feedback = submitInsightFeedbackSchema.parse({
      insightId: validUuid,
      feedback: 'HELPFUL',
    });
    expect(feedback.feedback).toBe('HELPFUL');

    expect(() =>
      submitInsightFeedbackSchema.parse({
        insightId: validUuid,
        feedback: 'EXCELLENT',
      })
    ).toThrow();
  });
});

describe('5. Schemas de Webhooks da Evolution API', () => {
  it('evolutionMessageKeySchema: deve validar a chave da mensagem do WhatsApp', () => {
    const validKey = {
      remoteJid: '5511999998888@s.whatsapp.net',
      fromMe: false,
      id: '3EB0ABC123456789',
    };
    const parsed = evolutionMessageKeySchema.parse(validKey);
    expect(parsed.id).toBe('3EB0ABC123456789');
    expect(parsed.fromMe).toBe(false);

    expect(() => evolutionMessageKeySchema.parse({ remoteJid: '' })).toThrow();
  });

  it('evolutionWebhookPayloadSchema: deve validar payload completo de mensagem de texto', () => {
    const webhookPayload = {
      event: 'messages.upsert',
      instance: 'wkontrol_bot',
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: 'MSG12345',
        },
        pushName: 'Carlos Silva',
        message: {
          conversation: 'Gastei 45 no almoço',
        },
        messageTimestamp: 1730000000,
      },
    };

    const parsed = evolutionWebhookPayloadSchema.parse(webhookPayload);
    const data = parsed.data as EvolutionMessageData;
    expect(parsed.instance).toBe('wkontrol_bot');
    expect(data.message?.conversation).toBe('Gastei 45 no almoço');
  });

  it('evolutionAudioMessageSchema: deve validar payload real de áudio da Evolution API v2 com url: null, ptt: true, seconds: 4', () => {
    const rawAudio = {
      url: null,
      mimetype: 'audio/ogg; codecs=opus',
      seconds: 4,
      ptt: true,
      caption: null,
      directPath: '/v/t62.7114-24/audio.enc',
    };

    const parsed = evolutionAudioMessageSchema.parse(rawAudio);
    expect(parsed.url).toBeNull();
    expect(parsed.ptt).toBe(true);
    expect(parsed.seconds).toBe(4);
    expect(parsed.mimetype).toBe('audio/ogg; codecs=opus');
  });

  it('evolutionImageMessageSchema: deve validar payload real de imagem da Evolution API v2 com url: null, caption: null', () => {
    const rawImage = {
      url: null,
      mimetype: 'image/jpeg',
      caption: null,
      directPath: '/v/t62.7114-24/image.enc',
    };

    const parsed = evolutionImageMessageSchema.parse(rawImage);
    expect(parsed.url).toBeNull();
    expect(parsed.caption).toBeNull();
    expect(parsed.mimetype).toBe('image/jpeg');
  });

  it('evolutionWebhookPayloadSchema: deve validar webhook com audioMessage contendo url: null, ptt: true, seconds: 4', () => {
    const webhookAudioPayload = {
      event: 'messages.upsert',
      instance: 'wkontrol_bot',
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: 'MSG-AUDIO-NULL-URL',
        },
        pushName: 'Carlos Silva',
        message: {
          audioMessage: {
            url: null,
            mimetype: 'audio/ogg; codecs=opus',
            seconds: 4,
            ptt: true,
            caption: null,
          },
        },
        messageType: 'audioMessage',
        messageTimestamp: 1730000000,
      },
    };

    const parsed = evolutionWebhookPayloadSchema.parse(webhookAudioPayload);
    const data = parsed.data as EvolutionMessageData;
    expect(data.message?.audioMessage?.url).toBeNull();
    expect(data.message?.audioMessage?.ptt).toBe(true);
    expect(data.message?.audioMessage?.seconds).toBe(4);
  });

  it('evolutionWebhookPayloadSchema: deve validar webhook com imageMessage contendo url: null, caption: null', () => {
    const webhookImagePayload = {
      event: 'messages.upsert',
      instance: 'wkontrol_bot',
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: 'MSG-IMAGE-NULL-URL',
        },
        pushName: 'Carlos Silva',
        message: {
          imageMessage: {
            url: null,
            mimetype: 'image/jpeg',
            caption: null,
          },
        },
        messageType: 'imageMessage',
        messageTimestamp: 1730000000,
      },
    };

    const parsed = evolutionWebhookPayloadSchema.parse(webhookImagePayload);
    const data = parsed.data as EvolutionMessageData;
    expect(data.message?.imageMessage?.url).toBeNull();
    expect(data.message?.imageMessage?.caption).toBeNull();
    expect(data.message?.imageMessage?.mimetype).toBe('image/jpeg');
  });

  it('whatsAppInboundJobDataSchema: deve validar contrato do Job do BullMQ', () => {
    const jobData = {
      messageId: 'MSG-BULL-123',
      instance: 'wkontrol_bot',
      remoteJid: '5511999998888@s.whatsapp.net',
      normalizedPhone: '+5511999998888',
      senderName: 'Carlos Silva',
      type: 'text',
      content: {
        text: 'Gastei 45 no almoço',
      },
      timestamp: 1730000000,
      receivedAt: new Date().toISOString(),
    };

    const parsed = whatsAppInboundJobDataSchema.parse(jobData);
    expect(parsed.normalizedPhone).toBe('+5511999998888');
    expect(parsed.type).toBe('text');
  });

  it('evolutionSendTextPayloadSchema: deve validar parâmetros de envio de mensagem', () => {
    const payload = evolutionSendTextPayloadSchema.parse({
      number: '5511999998888',
      text: 'Confirma o lançamento de R$ 45,00?',
    });
    expect(payload.number).toBe('5511999998888');
    expect(payload.delay).toBe(1200); // Default

    expect(() =>
      evolutionSendTextPayloadSchema.parse({
        number: '',
        text: 'Olá',
      })
    ).toThrow();
  });

  it('whatsAppOtpVerificationSchema: deve exigir exatamente 6 dígitos numéricos e telefone E.164', () => {
    const validOtp = {
      code: '749201',
      whatsappPhone: '+5511999998888',
    };
    const parsed = whatsAppOtpVerificationSchema.parse(validOtp);
    expect(parsed.code).toBe('749201');

    expect(() =>
      whatsAppOtpVerificationSchema.parse({
        code: '12345', // 5 dígitos
        whatsappPhone: '+5511999998888',
      })
    ).toThrow();

    expect(() =>
      whatsAppOtpVerificationSchema.parse({
        code: 'abcdef', // Não numérico
        whatsappPhone: '+5511999998888',
      })
    ).toThrow();
  });

  it('whatsAppOtpGenerationSchema: deve validar IDs de usuário e tenant em UUID', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const parsed = whatsAppOtpGenerationSchema.parse({
      userId: validUuid,
      tenantId: validUuid,
    });
    expect(parsed.userId).toBe(validUuid);

    expect(() =>
      whatsAppOtpGenerationSchema.parse({
        userId: 'invalid-user',
        tenantId: validUuid,
      })
    ).toThrow();
  });
});
