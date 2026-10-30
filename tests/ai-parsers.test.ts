/**
 * WKontrolAI — Testes Unitários dos Parsers e Clientes de IA (Jev & DeepSeek)
 * Valida a extração estruturada de texto, OCR multimodal e decisões determinísticas System One
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeepSeekClient, getSaoPauloCurrentDate } from '@/lib/ai/deepseek';
import { GroqAudioClient } from '@/lib/ai/groq';
import { JevClient } from '@/lib/ai/jev';
import { llmExtractionResponseSchema } from '@/lib/validations/transaction';

describe('1. DeepSeek JSON Cleaning e Extração Semântica', () => {
  let deepseek: DeepSeekClient;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    deepseek = new DeepSeekClient('test-deepseek-api-key');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('deve extrair a data atual no fuso de São Paulo (America/Sao_Paulo)', () => {
    const spDate = getSaoPauloCurrentDate();
    expect(spDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('cleanJsonResponse: deve limpar blocos markdown ```json ... ``` e ``` ... ```', () => {
    // Usamos reflexão para acessar o método privado cleanJsonResponse
    const clientAny = deepseek as unknown as {
      cleanJsonResponse: (raw: string) => string;
    };

    const rawWithJsonFence = '```json\n{"has_financial_intent": true}\n```';
    expect(clientAny.cleanJsonResponse(rawWithJsonFence)).toBe('{"has_financial_intent": true}');

    const rawWithGenericFence = '```\n{"has_financial_intent": false}\n```';
    expect(clientAny.cleanJsonResponse(rawWithGenericFence)).toBe('{"has_financial_intent": false}');

    const cleanRaw = '{"has_financial_intent": true}';
    expect(clientAny.cleanJsonResponse(cleanRaw)).toBe('{"has_financial_intent": true}');
  });

  it('extractTransactionFromText: deve parsear com sucesso despesa simples em pt-BR', async () => {
    const mockApiResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              has_financial_intent: true,
              missing_information: null,
              transactions: [
                {
                  amount: 38.0,
                  type: 'EXPENSE',
                  suggested_category: 'Alimentação',
                  payment_method: 'DEBIT_CARD',
                  description: 'Almoço no quilo',
                  transaction_date: '2026-10-23',
                  confidence_score: 0.95,
                },
              ],
            }),
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as unknown as Response);

    const result = await deepseek.extractTransactionFromText(
      'Paguei 38 reais no almoço no quilo no débito',
      '2026-10-23'
    );

    expect(result.has_financial_intent).toBe(true);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].amount).toBe(38.0);
    expect(result.transactions[0].type).toBe('EXPENSE');
    expect(result.transactions[0].suggested_category).toBe('Alimentação');
    expect(result.transactions[0].payment_method).toBe('DEBIT_CARD');
  });

  it('extractTransactionFromText: deve parsear múltiplas transações na mesma mensagem', async () => {
    const mockMultiResponse = {
      choices: [
        {
          message: {
            content: `\`\`\`json
            {
              "has_financial_intent": true,
              "missing_information": null,
              "transactions": [
                {
                  "amount": 30.00,
                  "type": "EXPENSE",
                  "suggested_category": "Transporte",
                  "payment_method": "OTHER",
                  "description": "Uber",
                  "transaction_date": "2026-10-23"
                },
                {
                  "amount": 45.50,
                  "type": "EXPENSE",
                  "suggested_category": "Alimentação",
                  "payment_method": "PIX",
                  "description": "Almoço",
                  "transaction_date": "2026-10-23"
                }
              ]
            }
            \`\`\``,
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMultiResponse,
    } as unknown as Response);

    const result = await deepseek.extractTransactionFromText('Gastei 30 no Uber e 45,50 no almoço no Pix');
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].description).toBe('Uber');
    expect(result.transactions[1].payment_method).toBe('PIX');
    expect(result.transactions[1].amount).toBe(45.5);
  });

  it('extractTransactionFromText: deve tratar mensagem sem valor monetário informado', async () => {
    const mockIncompleteResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              has_financial_intent: true,
              missing_information: 'Entendi que você abasteceu no posto! Mas qual foi o valor gasto?',
              transactions: [],
            }),
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockIncompleteResponse,
    } as unknown as Response);

    const result = await deepseek.extractTransactionFromText('Abasteci o carro no posto Shell');
    expect(result.has_financial_intent).toBe(true);
    expect(result.missing_information).toContain('qual foi o valor gasto?');
    expect(result.transactions).toHaveLength(0);
  });

  it('processReceiptImage: deve parsear comprovante de transferência bancária Pix', async () => {
    const mockOcrResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              has_financial_intent: true,
              missing_information: null,
              transactions: [
                {
                  amount: 125.0,
                  type: 'EXPENSE',
                  suggested_category: 'Alimentação',
                  payment_method: 'PIX',
                  description: 'Supermercado Pão de Açúcar',
                  transaction_date: '2026-10-23',
                  confidence_score: 0.98,
                },
              ],
            }),
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOcrResponse,
    } as unknown as Response);

    const fakeImageBuffer = Buffer.from('fake-image-bytes');
    const result = await deepseek.processReceiptImage(fakeImageBuffer, 'image/jpeg');

    expect(result.has_financial_intent).toBe(true);
    expect(result.transactions[0].amount).toBe(125.0);
    expect(result.transactions[0].payment_method).toBe('PIX');
    expect(result.transactions[0].description).toBe('Supermercado Pão de Açúcar');
  });

  it('processReceiptImage: deve retornar não financeiro quando a foto não for comprovante', async () => {
    const mockNonFinancialResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              has_financial_intent: false,
              missing_information: 'Não identifiquei dados financeiros nesta imagem.',
              transactions: [],
            }),
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNonFinancialResponse,
    } as unknown as Response);

    const fakeImageBuffer = Buffer.from('cat-picture-bytes');
    const result = await deepseek.processReceiptImage(fakeImageBuffer, 'image/png');

    expect(result.has_financial_intent).toBe(false);
    expect(result.transactions).toHaveLength(0);
    expect(result.missing_information).toContain('Não identifiquei');
  });

  it('processReceiptImage: deve sanitizar mimetype composto (image/jpeg; charset=utf-8 -> image/jpeg) no data URL', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  has_financial_intent: true,
                  missing_information: null,
                  transactions: [
                    {
                      amount: 80.0,
                      type: 'EXPENSE',
                      suggested_category: 'Alimentação',
                      payment_method: 'PIX',
                      description: 'Jantar',
                      transaction_date: '2026-10-24',
                    },
                  ],
                }),
              },
            },
          ],
        }),
      } as Response);
    });

    const fakeImageBuffer = Buffer.from('test-image-bytes');
    await deepseek.processReceiptImage(fakeImageBuffer, 'image/jpeg; charset=utf-8');

    const captured = capturedBody as unknown as { messages?: Array<{ role: string; content: unknown }> } | null;
    const messages = captured?.messages;
    const userMessage = messages?.find((m) => m.role === 'user');
    const userContent = userMessage?.content as Array<{ type: string; image_url?: { url: string } }> | undefined;
    const imageUrl = userContent?.find((c) => c.type === 'image_url')?.image_url?.url;
    expect(imageUrl).toBeDefined();
    expect(imageUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(imageUrl).not.toContain('charset');
  });

  it('deve lançar erro se a chave DEEPSEEK_API_KEY não for informada', async () => {
    const emptyClient = new DeepSeekClient('');
    await expect(emptyClient.extractTransactionFromText('Gastei 50')).rejects.toThrow(
      /DEEPSEEK_API_KEY é obrigatória/
    );
  });
});

describe('2. Jev (TypeSafe AI) System One Client', () => {
  let jev: JevClient;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jev = new JevClient('test-jev-api-key');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('isConfirmationIntent: deve usar fast-path determinístico local para confirmações comuns sem chamar a API', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const confirmVariations = [
      'sim',
      'Sim',
      's',
      'S',
      'ok',
      'OK',
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

    for (const text of confirmVariations) {
      const isConfirmed = await jev.isConfirmationIntent(text);
      expect(isConfirmed).toBe(true);
    }

    // Garante que o fast-path resolveu 100% localmente sem nenhuma chamada HTTP
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('isCancellationIntent: deve usar fast-path determinístico local para cancelamentos comuns sem chamar a API', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const cancelVariations = [
      'não',
      'nao',
      'Não',
      'Nao',
      'n',
      'N',
      'cancela',
      'cancelar',
      'cancelado',
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

    for (const text of cancelVariations) {
      const isCancelled = await jev.isCancellationIntent(text);
      expect(isCancelled).toBe(true);
    }

    // Garante que o fast-path resolveu 100% localmente sem nenhuma chamada HTTP
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('classifyCategory: deve estruturar payload com campo criteria obrigatório para cada opção de categoria', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          model: 'jev-latest',
          answers: {
            category: {
              type: 'choice',
              choice: 'Alimentação',
              confidence: 0.95,
              probabilities: { Alimentação: 0.95, Outros: 0.05 },
            },
          },
        }),
      } as Response);
    });

    const result = await jev.classifyCategory('Almoço no self-service', [
      'Alimentação',
      'Transporte',
      'Lazer',
    ]);

    expect(result.category).toBe('Alimentação');
    expect(capturedBody).not.toBeNull();

    const questions = (capturedBody as unknown as { questions: Record<string, unknown> }).questions;
    const categoryQ = questions.category as {
      type: string;
      options: string[];
      criteria: Record<string, string>;
    };

    expect(categoryQ.type).toBe('choice');
    expect(categoryQ.options).toContain('Alimentação');
    expect(categoryQ.options).toContain('Outros');
    expect(categoryQ.criteria).toBeDefined();
    expect(typeof categoryQ.criteria).toBe('object');
    expect(typeof categoryQ.criteria['Alimentação']).toBe('string');
    expect(categoryQ.criteria['Alimentação'].length).toBeGreaterThan(5);
    expect(typeof categoryQ.criteria['Transporte']).toBe('string');
    expect(typeof categoryQ.criteria['Outros']).toBe('string');
  });

  it('classifyPaymentMethod: deve estruturar payload com campo criteria obrigatório para cada método de pagamento', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          model: 'jev-latest',
          answers: {
            payment_method: {
              type: 'choice',
              choice: 'PIX',
              confidence: 0.94,
              probabilities: { PIX: 0.94, OTHER: 0.06 },
            },
          },
        }),
      } as Response);
    });

    const result = await jev.classifyPaymentMethod('Paguei via chave Pix');
    expect(result.paymentMethod).toBe('PIX');
    expect(capturedBody).not.toBeNull();

    const questions = (capturedBody as unknown as { questions: Record<string, unknown> }).questions;
    const paymentQ = questions.payment_method as {
      type: string;
      options: string[];
      criteria: Record<string, string>;
    };

    expect(paymentQ.type).toBe('choice');
    expect(paymentQ.options).toContain('PIX');
    expect(paymentQ.options).toContain('CREDIT_CARD');
    expect(paymentQ.criteria).toBeDefined();
    expect(typeof paymentQ.criteria).toBe('object');
    expect(typeof paymentQ.criteria['PIX']).toBe('string');
    expect(paymentQ.criteria['PIX']).toContain('Pix');
    expect(typeof paymentQ.criteria['CREDIT_CARD']).toBe('string');
  });

  it('isConfirmationIntent: deve incluir criteria no payload para a Jev API quando fora do fast-path', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          model: 'jev-latest',
          answers: {
            is_confirm: {
              type: 'noul',
              decision: true,
              confidence: 0.96,
            },
          },
        }),
      } as Response);
    });

    // Frase que não bate no regex simples do fast-path
    const isConfirmed = await jev.isConfirmationIntent('Com certeza meu caro, pode prosseguir com o registro');
    expect(isConfirmed).toBe(true);

    const questions = (capturedBody as unknown as { questions: Record<string, unknown> }).questions;
    const confirmQ = questions.is_confirm as {
      type: string;
      instructions: string;
      criteria: { true: string; false: string };
    };

    expect(confirmQ.type).toBe('noul');
    expect(confirmQ.criteria).toBeDefined();
    expect(typeof confirmQ.criteria).toBe('object');
    expect(confirmQ.criteria.true).toBeDefined();
    expect(confirmQ.criteria.false).toBeDefined();
    expect(confirmQ.criteria.true.length).toBeGreaterThan(10);
    expect(confirmQ.criteria.false.length).toBeGreaterThan(10);
  });

  it('isCancellationIntent: deve incluir criteria no payload para a Jev API quando fora do fast-path', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          model: 'jev-latest',
          answers: {
            is_cancel: {
              type: 'noul',
              decision: true,
              confidence: 0.97,
            },
          },
        }),
      } as Response);
    });

    // Frase que não bate no regex simples do fast-path
    const isCancelled = await jev.isCancellationIntent('Desista de fazer o lançamento desta despesa');
    expect(isCancelled).toBe(true);

    const questions = (capturedBody as unknown as { questions: Record<string, unknown> }).questions;
    const cancelQ = questions.is_cancel as {
      type: string;
      instructions: string;
      criteria: { true: string; false: string };
    };

    expect(cancelQ.type).toBe('noul');
    expect(cancelQ.criteria).toBeDefined();
    expect(typeof cancelQ.criteria).toBe('object');
    expect(cancelQ.criteria.true).toBeDefined();
    expect(cancelQ.criteria.false).toBeDefined();
    expect(cancelQ.criteria.true.length).toBeGreaterThan(10);
    expect(cancelQ.criteria.false.length).toBeGreaterThan(10);
  });

  it('isFinancialTransaction: deve incluir criteria com propriedades true e false para a Jev API', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          model: 'jev-latest',
          answers: {
            is_financial: {
              type: 'noul',
              decision: true,
              confidence: 0.95,
            },
          },
        }),
      } as Response);
    });

    const isFinancial = await jev.isFinancialTransaction('Acabei de assinar um serviço mensal de streaming');
    expect(isFinancial).toBe(true);

    const questions = (capturedBody as unknown as { questions: Record<string, unknown> }).questions;
    const financialQ = questions.is_financial as {
      type: string;
      instructions: string;
      criteria: { true: string; false: string };
    };

    expect(financialQ.type).toBe('noul');
    expect(financialQ.criteria).toBeDefined();
    expect(typeof financialQ.criteria).toBe('object');
    expect(financialQ.criteria.true).toBeDefined();
    expect(financialQ.criteria.false).toBeDefined();
    expect(financialQ.criteria.true.length).toBeGreaterThan(10);
    expect(financialQ.criteria.false.length).toBeGreaterThan(10);
  });

  it('fluxo de confirmação pendente: avalia corretamente mensagens de confirmação e de descarte', async () => {
    // 1. Mensagens que devem confirmar
    const confirms = ['Sim', 'ok', 'pode salvar', '👍', 'beleza'];
    for (const msg of confirms) {
      const confirmsResult = await jev.isConfirmationIntent(msg);
      expect(confirmsResult).toBe(true);
      const cancelsResult = await jev.isCancellationIntent(msg);
      expect(cancelsResult).toBe(false);
    }

    // 2. Mensagens que devem descartar
    const cancels = ['Não', 'cancela', 'esquece', '❌', '🗑️'];
    for (const msg of cancels) {
      const cancelsResult = await jev.isCancellationIntent(msg);
      expect(cancelsResult).toBe(true);
      const confirmsResult = await jev.isConfirmationIntent(msg);
      expect(confirmsResult).toBe(false);
    }
  });

  it('classifyCategory: deve retornar "Outros" diretamente se não houver categorias disponíveis', async () => {
    const result = await jev.classifyCategory('Alguma coisa', []);
    expect(result.category).toBe('Outros');
    expect(result.confidence).toBe(1.0);
  });

  it('scoreAnomaly: deve estruturar criteria como array de strings e retornar pontuação contínua', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return Promise.resolve({
        ok: true,
        json: async () => ({
          model: 'jev-latest',
          answers: {
            anomaly_score: {
              type: 'score',
              score: 0.88,
              confidence: 0.9,
            },
          },
        }),
      } as Response);
    });

    const score = await jev.scoreAnomaly('Compra de R$ 9.800,00 às 03:45 da madrugada');
    expect(score).toBe(0.88);

    const questions = (capturedBody as unknown as { questions: Record<string, unknown> }).questions;
    const scoreQ = questions.anomaly_score as {
      type: string;
      instructions: string;
      criteria: string[];
    };

    expect(scoreQ.type).toBe('score');
    expect(scoreQ.criteria).toBeDefined();
    expect(Array.isArray(scoreQ.criteria)).toBe(true);
    expect(scoreQ.criteria.length).toBeGreaterThanOrEqual(2);
    expect(typeof scoreQ.criteria[0]).toBe('string');
  });

  it('deve lançar erro se a chave TYPESAFE_API_KEY não estiver presente em chamadas externas', async () => {
    const emptyJev = new JevClient('');
    await expect(emptyJev.ask('Estado', {})).rejects.toThrow(
      /TYPESAFE_API_KEY is required/
    );
  });
});

describe('3. Groq Audio Whisper Client', () => {
  let groq: GroqAudioClient;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    groq = new GroqAudioClient('test-groq-api-key');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('transcribeAudio: deve sanitizar mimetype removendo codecs extras (audio/ogg; codecs=opus -> audio/ogg)', async () => {
    let capturedFormData: unknown = null;
    globalThis.fetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedFormData = init?.body;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          text: 'Gastei vinte reais na padaria',
          duration: 3.5,
        }),
      } as Response);
    });

    const fakeAudioBuffer = Buffer.from('OggS-fake-audio');
    const result = await groq.transcribeAudio(fakeAudioBuffer, 'audio/ogg; codecs=opus');

    expect(result.text).toBe('Gastei vinte reais na padaria');
    expect(result.durationSeconds).toBe(3.5);
    expect(capturedFormData).toBeDefined();
    const file = (capturedFormData as FormData).get('file') as Blob;
    expect(file).toBeDefined();
    expect(file.type).toBe('audio/ogg');
  });

  it('transcribeAudio: deve lançar erro se GROQ_API_KEY não for informada', async () => {
    const emptyGroq = new GroqAudioClient('');
    const fakeAudioBuffer = Buffer.from('audio');
    await expect(emptyGroq.transcribeAudio(fakeAudioBuffer)).rejects.toThrow(
      /GROQ_API_KEY é obrigatória/
    );
  });
});
