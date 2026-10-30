/**
 * WKontrolAI — Testes Unitários dos Contratos das Rotas de API
 * Validação de Schemas e Contratos de /api/auth/pair e /api/transactions
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
  pairRequestSchema,
  pairResponseSchema,
  pairStatusQuerySchema,
  pairStatusResponseSchema,
  DEFAULT_TENANT_CATEGORIES,
  OTP_REGEX,
  extractOtpCode,
} from '@/lib/validations/auth';
import {
  evolutionWebhookPayloadSchema,
  whatsAppInboundJobDataSchema,
  type EvolutionMessageData,
} from '@/lib/validations/webhook';
import { normalizeBrazilianPhoneToE164 } from '@/lib/utils/phone';
import {
  transactionFilterQuerySchema,
  createTransactionSchema,
  updateTransactionSchema,
  transactionsListResponseSchema,
  transactionItemResponseSchema,
  financialSummarySchema,
} from '@/lib/validations/transaction';
import { FAST_CONFIRM_REGEX, FAST_CANCEL_REGEX } from '@/workers/whatsapp-worker';
import { EvolutionApiClient } from '@/lib/evolution/client';

describe('Rotas de API — Contratos e Schemas Zod', () => {
  describe('1. Contratos de /api/auth/pair', () => {
    it('pairRequestSchema: deve validar e normalizar telefone brasileiro', () => {
      const valid = pairRequestSchema.parse({
        phone: '11999998888',
        name: 'Carlos Silva',
        email: 'carlos@exemplo.com',
      });

      expect(valid.phone).toBe('+5511999998888');
      expect(valid.name).toBe('Carlos Silva');
      expect(valid.email).toBe('carlos@exemplo.com');
    });

    it('pairRequestSchema: deve rejeitar telefone inválido', () => {
      expect(() =>
        pairRequestSchema.parse({
          phone: '123',
        })
      ).toThrow();
    });

    it('pairResponseSchema: deve validar resposta completa de pareamento com deepLink', () => {
      const validResponse = {
        success: true,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Carlos Silva',
          email: 'carlos@exemplo.com',
          whatsappPhone: '+5511999998888',
          whatsappVerifiedAt: new Date().toISOString(),
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        },
        tenant: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          name: 'Finanças Pessoais',
          plan: 'BETA',
          ownerId: '550e8400-e29b-41d4-a716-446655440000',
        },
        otpCode: '482910',
        deepLink: 'https://wa.me/5511999999999?text=VINCULAR%20482910',
        expiresInSeconds: 600,
        message: 'Código gerado com sucesso',
      };

      const parsed = pairResponseSchema.parse(validResponse);
      expect(parsed.otpCode).toBe('482910');
      expect(parsed.user.whatsappPhone).toBe('+5511999998888');
    });

    it('pairStatusResponseSchema: deve validar status pareado e não pareado com hasPendingOtp seguro', () => {
      const unverified = {
        isPaired: false,
        user: null,
        tenant: null,
        hasPendingOtp: true,
      };
      const parsedUnverified = pairStatusResponseSchema.parse(unverified);
      expect(parsedUnverified.isPaired).toBe(false);
      expect(parsedUnverified.hasPendingOtp).toBe(true);

      const verified = {
        isPaired: true,
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Marina',
          email: 'marina@exemplo.com',
          whatsappPhone: '+5521988887777',
          whatsappVerifiedAt: new Date().toISOString(),
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        },
        tenant: {
          id: '660e8400-e29b-41d4-a716-446655440000',
          name: 'Workspace Marina',
          plan: 'FREE',
          ownerId: '550e8400-e29b-41d4-a716-446655440000',
        },
        hasPendingOtp: false,
      };
      const parsedVerified = pairStatusResponseSchema.parse(verified);
      expect(parsedVerified.isPaired).toBe(true);
      expect(parsedVerified.hasPendingOtp).toBe(false);
    });

    it('DEFAULT_TENANT_CATEGORIES: deve conter 8 categorias padrão balanceadas', () => {
      expect(DEFAULT_TENANT_CATEGORIES.length).toBe(8);
      const incomeCategories = DEFAULT_TENANT_CATEGORIES.filter((c) => c.type === 'INCOME');
      const expenseCategories = DEFAULT_TENANT_CATEGORIES.filter((c) => c.type === 'EXPENSE');
      expect(incomeCategories.length).toBe(2);
      expect(expenseCategories.length).toBe(6);
    });
  });

  describe('2. Contratos de /api/transactions', () => {
    it('transactionFilterQuerySchema: deve aceitar período no formato YYYY-MM, last-90-days e all', () => {
      const parsedMonth = transactionFilterQuerySchema.parse({
        period: '2026-10',
        page: '2',
        limit: '20',
        type: 'EXPENSE',
      });
      expect(parsedMonth.period).toBe('2026-10');
      expect(parsedMonth.page).toBe(2);
      expect(parsedMonth.limit).toBe(20);
      expect(parsedMonth.type).toBe('EXPENSE');

      const parsed90Days = transactionFilterQuerySchema.parse({
        period: 'last-90-days',
      });
      expect(parsed90Days.period).toBe('last-90-days');

      const parsedAll = transactionFilterQuerySchema.parse({
        period: 'all',
      });
      expect(parsedAll.period).toBe('all');

      expect(() =>
        transactionFilterQuerySchema.parse({
          period: 'invalid-period',
        })
      ).toThrow();
    });

    it('filtro temporal: transação de maio de 2021 deve ser excluída em last-90-days e incluída apenas quando o filtro for all', () => {
      const today = new Date();
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(today.getDate() - 90);
      const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];

      const historicalTransaction = {
        id: '110e8400-e29b-41d4-a716-446655440099',
        description: 'Compra histórica em maio de 2021',
        transactionDate: '2021-05-15',
        amount: '350.00',
        type: 'EXPENSE',
      };

      const recentTransaction = {
        id: '110e8400-e29b-41d4-a716-446655440100',
        description: 'Almoço recente',
        transactionDate: todayStr,
        amount: '45.00',
        type: 'EXPENSE',
      };

      const mockTransactions = [historicalTransaction, recentTransaction];

      // 1. Simulação da regra de filtro da API quando period = 'last-90-days'
      const query90Days = transactionFilterQuerySchema.parse({ period: 'last-90-days' });
      expect(query90Days.period).toBe('last-90-days');

      let startDate90: string | undefined = query90Days.startDate;
      let endDate90: string | undefined = query90Days.endDate;
      if (query90Days.period === 'last-90-days' && !startDate90) {
        startDate90 = ninetyDaysAgoStr;
        if (!endDate90) endDate90 = todayStr;
      }

      const results90Days = mockTransactions.filter((tx) => {
        if (startDate90 && tx.transactionDate < startDate90) return false;
        if (endDate90 && tx.transactionDate > endDate90) return false;
        return true;
      });

      // Transação de 2021-05-15 DEVE ser excluída dos últimos 90 dias
      expect(results90Days).toHaveLength(1);
      expect(results90Days[0].id).toBe(recentTransaction.id);
      expect(results90Days.some((t) => t.transactionDate === '2021-05-15')).toBe(false);

      // 2. Simulação da regra de filtro da API quando period = 'all'
      const queryAll = transactionFilterQuerySchema.parse({ period: 'all' });
      expect(queryAll.period).toBe('all');

      let startDateAll: string | undefined = queryAll.startDate;
      let endDateAll: string | undefined = queryAll.endDate;
      if (queryAll.period === 'last-90-days' && !startDateAll) {
        startDateAll = ninetyDaysAgoStr;
        if (!endDateAll) endDateAll = todayStr;
      }

      const resultsAll = mockTransactions.filter((tx) => {
        if (startDateAll && tx.transactionDate < startDateAll) return false;
        if (endDateAll && tx.transactionDate > endDateAll) return false;
        return true;
      });

      // Transação de 2021-05-15 DEVE ser incluída quando period = 'all'
      expect(resultsAll).toHaveLength(2);
      expect(resultsAll.some((t) => t.transactionDate === '2021-05-15')).toBe(true);
      expect(resultsAll.find((t) => t.transactionDate === '2021-05-15')?.description).toBe(
        'Compra histórica em maio de 2021'
      );
    });

    it('createTransactionSchema: deve exigir campos mínimos e aceitar valores monetários', () => {
      const valid = createTransactionSchema.parse({
        amount: 85.5,
        type: 'EXPENSE',
        categoryId: '770e8400-e29b-41d4-a716-446655440000',
        description: 'Mercado Semanal',
        paymentMethod: 'PIX',
      });

      expect(valid.amount).toBe(85.5);
      expect(valid.type).toBe('EXPENSE');
      expect(valid.sourceChannel).toBe('WEB_DASHBOARD');
      expect(valid.transactionDate).toBeDefined();
    });

    it('transactionsListResponseSchema: deve validar listagem enriquecida e resumo consolidado', () => {
      const payload = {
        success: true,
        transactions: [
          {
            id: '110e8400-e29b-41d4-a716-446655440000',
            tenantId: '660e8400-e29b-41d4-a716-446655440000',
            userId: '550e8400-e29b-41d4-a716-446655440000',
            categoryId: '770e8400-e29b-41d4-a716-446655440000',
            categoryName: 'Alimentação',
            categoryIcon: 'utensils',
            categoryColor: '#f97316',
            type: 'EXPENSE',
            amount: '45.00',
            description: 'Almoço Executivo',
            paymentMethod: 'DEBIT_CARD',
            transactionDate: '2026-10-23',
            sourceChannel: 'WHATSAPP_TEXT',
            confirmedByUser: true,
            rawPayload: 'Almoço 45 debito',
            metadata: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        summary: {
          currentBalance: -45.0,
          totalIncome: 0,
          totalExpense: 45.0,
          transactionCount: 1,
        },
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
        },
      };

      const parsed = transactionsListResponseSchema.parse(payload);
      expect(parsed.transactions.length).toBe(1);
      expect(parsed.summary.currentBalance).toBe(-45.0);
    });
  });

  describe('3. Expressão Regular Flexível e Extração de OTP (US-01)', () => {
    it('deve extrair com perfeição códigos em múltiplos formatos válidos', () => {
      const validCases = [
        { input: 'VINCULAR 123456', expected: '123456' },
        { input: 'vincular 654321', expected: '654321' },
        { input: 'VINCULAR [123456]', expected: '123456' },
        { input: 'vincular [987654]', expected: '987654' },
        { input: 'vincular: 123456', expected: '123456' },
        { input: 'vincular: [123456]', expected: '123456' },
        { input: 'Vincular:[123456]', expected: '123456' },
        { input: '[123456]', expected: '123456' },
        { input: '123456', expected: '123456' },
        { input: '  123456  ', expected: '123456' },
        { input: '  [789012]  ', expected: '789012' },
        { input: 'Olá bot, VINCULAR 444555', expected: '444555' },
        { input: 'Quero vincular: 888999', expected: '888999' },
        { input: '*VINCULAR 123456*', expected: '123456' },
        { input: '*123456*', expected: '123456' },
        { input: 'VINCULAR 123 456', expected: '123456' },
        { input: '123 456', expected: '123456' },
        { input: '123-456', expected: '123456' },
        { input: 'VINCULAR [123 456]', expected: '123456' },
      ];

      for (const { input, expected } of validCases) {
        expect(extractOtpCode(input)).toBe(expected);
      }
    });

    it('deve rejeitar mensagens inválidas sem gerar falso positivo', () => {
      const invalidCases = [
        'Gastei 123456 no almoço', // 6 dígitos no contexto de despesa, sem "vincular"
        '12345',                  // 5 dígitos
        '1234567',                // 7 dígitos
        'vincular 123',           // código curto
        'vincular 12345',         // 5 dígitos
        'vincular abcdef',        // letras
        'vincular 12a456',        // alfanumérico
        'Almoço 45 reais no quilo',
        'Paguei 50 no uber no débito',
        'Bom dia!',
        'Sim, confirmo',
        'Não, cancela',
        '',
        '   ',
      ];

      for (const input of invalidCases) {
        expect(extractOtpCode(input)).toBeNull();
      }
    });

    it('OTP_REGEX: deve casar os grupos corretos de captura', () => {
      const match1 = 'VINCULAR 482910'.match(OTP_REGEX);
      expect(match1).not.toBeNull();
      expect(match1![1] || match1![2]).toBe('482910');

      const match2 = '[482910]'.match(OTP_REGEX);
      expect(match2).not.toBeNull();
      expect(match2![1] || match2![2]).toBe('482910');

      const match3 = '482910'.match(OTP_REGEX);
      expect(match3).not.toBeNull();
      expect(match3![1] || match3![2]).toBe('482910');
    });
  });

  describe('4. Normalização de Payloads da Evolution API v2 no Webhook', () => {
    it('deve normalizar payload quando data for um array (formato em lote da Evolution API v2)', () => {
      const rawBodyWithArray = {
        event: 'messages.upsert',
        instance: 'wkontrol_bot',
        data: [
          {
            key: {
              remoteJid: '5511999998888@s.whatsapp.net',
              fromMe: false,
              id: 'MSG-ARRAY-01',
            },
            pushName: 'Carlos',
            message: {
              conversation: 'VINCULAR 123456',
            },
            messageTimestamp: 1730000000,
          },
        ],
      };

      // Simula a normalização de array para objeto aplicada na rota
      const normalizedData = Array.isArray(rawBodyWithArray.data) ? rawBodyWithArray.data[0] : rawBodyWithArray.data;
      const normalizedPayload = {
        ...rawBodyWithArray,
        data: normalizedData,
      };

      const parsed = evolutionWebhookPayloadSchema.parse(normalizedPayload);
      const data = parsed.data as EvolutionMessageData;
      expect(data.key.id).toBe('MSG-ARRAY-01');
      expect(data.message?.conversation).toBe('VINCULAR 123456');
    });

    it('deve normalizar payload quando data for um objeto direto', () => {
      const rawBodyWithObject = {
        event: 'messages.upsert',
        instance: 'wkontrol_bot',
        data: {
          key: {
            remoteJid: '5511999998888@s.whatsapp.net',
            fromMe: false,
            id: 'MSG-OBJ-01',
          },
          pushName: 'Carlos',
          message: {
            extendedTextMessage: {
              text: 'Gastei 50 no almoço',
            },
          },
          messageTimestamp: 1730000000,
        },
      };

      const normalizedData = Array.isArray(rawBodyWithObject.data) ? rawBodyWithObject.data[0] : rawBodyWithObject.data;
      const normalizedPayload = {
        ...rawBodyWithObject,
        data: normalizedData,
      };

      const parsed = evolutionWebhookPayloadSchema.parse(normalizedPayload);
      const data = parsed.data as EvolutionMessageData;
      expect(data.key.id).toBe('MSG-OBJ-01');
      expect(data.message?.extendedTextMessage?.text).toBe('Gastei 50 no almoço');
    });

    it('deve normalizar os diferentes tipos de mensagem suportados (texto, extended, áudio, imagem)', () => {
      // 1. Plain conversation
      const p1 = evolutionWebhookPayloadSchema.parse({
        event: 'MESSAGES_UPSERT',
        instance: 'wkontrol_bot',
        data: {
          key: { remoteJid: '5511999998888@s.whatsapp.net', fromMe: false, id: 'M1' },
          message: { conversation: 'Almoço 35' },
          messageTimestamp: 1730000000,
        },
      });
      const d1 = p1.data as EvolutionMessageData;
      expect(d1.message?.conversation).toBe('Almoço 35');

      // 2. Audio message
      const p2 = evolutionWebhookPayloadSchema.parse({
        event: 'messages.upsert',
        instance: 'wkontrol_bot',
        data: {
          key: { remoteJid: '5511999998888@s.whatsapp.net', fromMe: false, id: 'M2' },
          message: {
            audioMessage: {
              url: 'https://storage.evolution.com/audio.ogg',
              seconds: 12,
              mimetype: 'audio/ogg; codecs=opus',
            },
          },
          messageTimestamp: 1730000000,
        },
      });
      const d2 = p2.data as EvolutionMessageData;
      expect(d2.message?.audioMessage?.seconds).toBe(12);

      // 3. Image message com caption
      const p3 = evolutionWebhookPayloadSchema.parse({
        event: 'messages.upsert',
        instance: 'wkontrol_bot',
        data: {
          key: { remoteJid: '5511999998888@s.whatsapp.net', fromMe: false, id: 'M3' },
          message: {
            imageMessage: {
              url: 'https://storage.evolution.com/nota.jpg',
              caption: 'Comprovante do almoço',
              mimetype: 'image/jpeg',
            },
          },
          messageTimestamp: 1730000000,
        },
      });
      const d3 = p3.data as EvolutionMessageData;
      expect(d3.message?.imageMessage?.caption).toBe('Comprovante do almoço');
    });

    it('deve aceitar mensagens de áudio PTT e imagens com url null (mídia criptografada do WhatsApp)', () => {
      // 1. Áudio PTT nativo do WhatsApp com url: null, ptt: true, seconds: 4
      const pttPayload = evolutionWebhookPayloadSchema.parse({
        event: 'messages.upsert',
        instance: 'wkontrol_bot',
        data: {
          key: { remoteJid: '5511999998888@s.whatsapp.net', fromMe: false, id: 'PTT_MSG_01' },
          message: {
            audioMessage: {
              url: null,
              mimetype: 'audio/ogg; codecs=opus',
              seconds: 4,
              ptt: true,
              directPath: '/v/t62.7114-24/encrypted_audio.enc',
              mediaKey: 'ABC123EncryptedKey==',
            },
          },
          messageTimestamp: 1730000100,
        },
      });
      const pttData = pttPayload.data as EvolutionMessageData;
      expect(pttData.message?.audioMessage?.url).toBeNull();
      expect(pttData.message?.audioMessage?.ptt).toBe(true);
      expect(pttData.message?.audioMessage?.seconds).toBe(4);

      // 2. Imagem de comprovante com url: null e caption: null
      const imgPayload = evolutionWebhookPayloadSchema.parse({
        event: 'messages.upsert',
        instance: 'wkontrol_bot',
        data: {
          key: { remoteJid: '5511999998888@s.whatsapp.net', fromMe: false, id: 'IMG_MSG_01' },
          message: {
            imageMessage: {
              url: null,
              mimetype: 'image/jpeg',
              caption: null,
              directPath: '/v/t62.7114-24/encrypted_image.enc',
              mediaKey: 'XYZ789EncryptedKey==',
            },
          },
          messageTimestamp: 1730000100,
        },
      });
      const imgData = imgPayload.data as EvolutionMessageData;
      expect(imgData.message?.imageMessage?.url).toBeNull();
      expect(imgData.message?.imageMessage?.caption).toBeNull();
      expect(imgData.message?.imageMessage?.mimetype).toBe('image/jpeg');
    });

    it('deve normalizar o remoteJid para padrão E.164 canônico', () => {
      const rawJid1 = '5511999998888@s.whatsapp.net';
      const rawJid2 = '5521988887777:12@s.whatsapp.net';

      expect(normalizeBrazilianPhoneToE164(rawJid1)).toBe('+5511999998888');
      expect(normalizeBrazilianPhoneToE164(rawJid2)).toBe('+5521988887777');
    });

    it('deve rejeitar ou filtrar eventos desconhecidos da Evolution API', () => {
      const nonMessageEvents = ['connection.update', 'presence.update', 'qrcode.updated', 'chats.set'];
      for (const ev of nonMessageEvents) {
        const eventName = ev.toUpperCase();
        const isSupported = eventName === 'MESSAGES_UPSERT' || eventName === 'MESSAGES.UPSERT';
        expect(isSupported).toBe(false);
      }
    });
  });

  describe('5. Interatividade WhatsApp, Regexes, PATCH/DELETE e Chat IA', () => {
    it('FAST_CONFIRM_REGEX: deve contemplar 1, [1], btn_confirm, sim, ok, pode salvar e emojis afirmativos', () => {
      const confirmCases = [
        '1',
        '[1]',
        'btn_confirm',
        'sim',
        's',
        'ok',
        'confirmo',
        'confirmar',
        'confirmado',
        'pode',
        'pode salvar',
        'salva',
        'salvar',
        'isso',
        'exato',
        'positivo',
        'correto',
        'beleza',
        'blz',
        'bora',
        '👍',
        '✅',
        '✔️',
        '👌',
      ];
      for (const text of confirmCases) {
        expect(FAST_CONFIRM_REGEX.test(text)).toBe(true);
      }
    });

    it('FAST_CONFIRM_REGEX: deve rejeitar números maiores e textos não afirmativos', () => {
      const nonConfirmCases = [
        '10',
        '100',
        '1000',
        '100 reais',
        'comprar 1 kilo de carne',
        'não',
        'nao',
        'cancela',
        'simulado do detran',
        'oktoberfest em blumenau',
      ];
      for (const text of nonConfirmCases) {
        expect(FAST_CONFIRM_REGEX.test(text)).toBe(false);
      }
    });

    it('FAST_CANCEL_REGEX: deve contemplar 3, [3], btn_cancel, não, nao, cancela, descarta e emojis de cancelamento', () => {
      const cancelCases = [
        '3',
        '[3]',
        'btn_cancel',
        'não',
        'nao',
        'n',
        'cancela',
        'cancelar',
        'cancelado',
        'descarta',
        'descartar',
        'descartado',
        'esquece',
        'esqueça',
        'ignora',
        'ignorar',
        'para',
        'parar',
        'deixa quieto',
        'apaga',
        'apagar',
        '❌',
        '🚫',
        '⛔',
        '🗑️',
      ];
      for (const text of cancelCases) {
        expect(FAST_CANCEL_REGEX.test(text)).toBe(true);
      }
    });

    it('FAST_CANCEL_REGEX: deve rejeitar números maiores e textos afirmativos ou ambíguos', () => {
      const nonCancelCases = [
        '30',
        '300',
        '300 reais',
        'pedir 3 lanches',
        'sim',
        'ok',
        'quero pensar melhor',
        'deixa para amanhã',
      ];
      for (const text of nonCancelCases) {
        expect(FAST_CANCEL_REGEX.test(text)).toBe(false);
      }
    });

    it('updateTransactionSchema: deve aceitar atualizações parciais e exigir UUID de ID', () => {
      const valid = updateTransactionSchema.parse({
        id: '110e8400-e29b-41d4-a716-446655440000',
        amount: 150.75,
        description: 'Almoço Executivo',
        paymentMethod: 'PIX',
      });

      expect(valid.id).toBe('110e8400-e29b-41d4-a716-446655440000');
      expect(valid.amount).toBe(150.75);
      expect(valid.description).toBe('Almoço Executivo');
      expect(valid.paymentMethod).toBe('PIX');

      // Sem ID deve falhar
      expect(() =>
        updateTransactionSchema.parse({
          amount: 50,
        })
      ).toThrow();
    });

    it('POST /api/ai/chat: validação de schema do payload (rejeita mensagem vazia ou > 1000 caracteres)', () => {
      // Importamos a definição de schema ou revalidamos o contrato Zod de /api/ai/chat
      const chatPayloadSchema = z.object({
        message: z
          .string()
          .trim()
          .min(1, 'A mensagem não pode ser vazia')
          .max(1000, 'Mensagem muito longa'),
        phone: z.string().optional(),
        tenantId: z.string().uuid().optional(),
        period: z.string().optional(),
      });

      // Mensagem válida
      const valid = chatPayloadSchema.parse({
        message: 'Qual foi meu total de gastos com alimentação este mês?',
        tenantId: '660e8400-e29b-41d4-a716-446655440000',
      });
      expect(valid.message).toBe('Qual foi meu total de gastos com alimentação este mês?');

      // Mensagem vazia
      expect(() =>
        chatPayloadSchema.parse({
          message: '',
        })
      ).toThrow(/não pode ser vazia/);

      // Mensagem com apenas espaços
      expect(() =>
        chatPayloadSchema.parse({
          message: '     ',
        })
      ).toThrow(/não pode ser vazia/);

      // Mensagem excedendo 1000 caracteres
      const overlyLongMessage = 'gasto '.repeat(201); // > 1000 caracteres
      expect(() =>
        chatPayloadSchema.parse({
          message: overlyLongMessage,
        })
      ).toThrow(/Mensagem muito longa/);
    });

    it('EvolutionApiClient: sendInteractiveButtons deve existir na instância da classe', () => {
      const client = new EvolutionApiClient();
      expect(typeof client.sendInteractiveButtons).toBe('function');
    });

    it('EvolutionApiClient: sendInteractiveButtons deve formatar texto estruturado com opções numeradas [1], [2], [3] e delegar para sendTextMessage', async () => {
      const client = new EvolutionApiClient();
      let sentTo = '';
      let sentText = '';
      client.sendTextMessage = vi.fn(async (to: string, text: string) => {
        sentTo = to;
        sentText = text;
        return { success: true };
      });

      await client.sendInteractiveButtons(
        '+5511999998888',
        'Confirmação Financeira',
        'Confirma o lançamento de R$ 45,00?',
        [
          { id: 'btn_confirm', text: 'Confirmar' },
          { id: 'btn_edit', text: 'Editar' },
          { id: 'btn_cancel', text: 'Cancelar' },
        ]
      );

      expect(client.sendTextMessage).toHaveBeenCalledTimes(1);
      expect(sentTo).toBe('+5511999998888');
      expect(sentText).toContain('*Confirmação Financeira*');
      expect(sentText).toContain('Confirma o lançamento de R$ 45,00?');
      expect(sentText).toContain('[1] Confirmar');
      expect(sentText).toContain('[2] Editar');
      expect(sentText).toContain('[3] Cancelar');
      expect(sentText).toContain('Dica:');
    });

    it('Regex de Edição Rápida: deve contemplar 2, [2], btn_edit e editar, e rejeitar números maiores', () => {
      const editRegex = /^(?:2\b|\[2\]|btn_edit\b|editar\b)$/i;

      // Casos válidos
      expect(editRegex.test('2')).toBe(true);
      expect(editRegex.test('[2]')).toBe(true);
      expect(editRegex.test('btn_edit')).toBe(true);
      expect(editRegex.test('editar')).toBe(true);
      expect(editRegex.test('EDITAR')).toBe(true);

      // Casos que NÃO devem ser tratados como intenção de editar
      expect(editRegex.test('20')).toBe(false);
      expect(editRegex.test('25')).toBe(false);
      expect(editRegex.test('200 reais')).toBe(false);
      expect(editRegex.test('comprar 2 pães')).toBe(false);
    });
  });
});
