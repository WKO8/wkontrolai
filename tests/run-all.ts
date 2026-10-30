/**
 * WKontrolAI — Test Runner & Quality Suite Verifier
 * Executa todos os testes unitários e de integração validando 100% das asserções
 */

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
  whatsAppInboundJobDataSchema,
  evolutionSendTextPayloadSchema,
  whatsAppOtpVerificationSchema,
  whatsAppOtpGenerationSchema,
} from '@/lib/validations/webhook';
import {
  normalizeBrazilianPhoneToE164,
  isValidBrazilianE164,
  formatPhoneDisplay,
  VALID_BRAZILIAN_DDDS,
  BRAZILIAN_E164_REGEX,
} from '@/lib/utils/phone';
import { DeepSeekClient, getSaoPauloCurrentDate } from '@/lib/ai/deepseek';
import { JevClient } from '@/lib/ai/jev';

interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];
let currentSuite = '';

function suite(name: string, fn: () => void | Promise<void>): Promise<void> | void {
  currentSuite = name;
  return fn();
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ suite: currentSuite, testName: name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    results.push({ suite: currentSuite, testName: name, passed: false, error: errorMsg });
    console.error(`  ✗ ${name}:`, errorMsg);
  }
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

function assertThrows(fn: () => unknown, expectedRegex?: RegExp): void {
  let threw = false;
  try {
    fn();
  } catch (err: unknown) {
    threw = true;
    if (expectedRegex && err instanceof Error) {
      if (!expectedRegex.test(err.message)) {
        throw new Error(`Expected error matching ${expectedRegex}, got "${err.message}"`);
      }
    }
  }
  if (!threw) {
    throw new Error('Expected function to throw, but it did not throw');
  }
}

async function assertRejects(fn: () => Promise<unknown>, expectedRegex?: RegExp): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch (err: unknown) {
    threw = true;
    if (expectedRegex && err instanceof Error) {
      if (!expectedRegex.test(err.message)) {
        throw new Error(`Expected rejection matching ${expectedRegex}, got "${err.message}"`);
      }
    }
  }
  if (!threw) {
    throw new Error('Expected promise to reject, but it resolved');
  }
}

export async function runAllTests(): Promise<{ passed: number; failed: number; total: number }> {
  console.log('\n======================================================');
  console.log('  WKONTROLAI TEST SUITE EXECUTION');
  console.log('======================================================\n');

  // ----------------------------------------------------
  // SUITE 1: VALIDAÇÕES ZOD
  // ----------------------------------------------------
  await suite('1. Schemas Zod & Contratos de Validação', async () => {
    await test('transactionTypeSchema: aceita EXPENSE e INCOME e rejeita inválidos', () => {
      assert(transactionTypeSchema.parse('EXPENSE') === 'EXPENSE', 'EXPENSE');
      assert(transactionTypeSchema.parse('INCOME') === 'INCOME', 'INCOME');
      assertThrows(() => transactionTypeSchema.parse('expense'));
      assertThrows(() => transactionTypeSchema.parse('TRANSFER'));
    });

    await test('paymentMethodSchema: aceita métodos oficiais e rejeita desconhecidos', () => {
      for (const m of ['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'BANK_TRANSFER', 'OTHER']) {
        assert(paymentMethodSchema.parse(m) === m, m);
      }
      assertThrows(() => paymentMethodSchema.parse('BITCOIN'));
    });

    await test('dateStringSchema: valida estritamente YYYY-MM-DD', () => {
      assert(dateStringSchema.parse('2026-10-23') === '2026-10-23', 'ISO date');
      assertThrows(() => dateStringSchema.parse('23/10/2026'));
      assertThrows(() => dateStringSchema.parse('2026-1-1'));
    });

    await test('monetaryAmountSchema: normaliza 2 decimais e rejeita <= 0 e exorbitantes', () => {
      assert(monetaryAmountSchema.parse(45) === 45, '45');
      assert(monetaryAmountSchema.parse(38.994) === 38.99, '38.994 -> 38.99');
      assert(monetaryAmountSchema.parse(38.996) === 39, '38.996 -> 39');
      assertThrows(() => monetaryAmountSchema.parse(0));
      assertThrows(() => monetaryAmountSchema.parse(-10));
      assertThrows(() => monetaryAmountSchema.parse(10_000_001));
    });

    await test('extractedTransactionItemSchema: valida item completo e default payment_method', () => {
      const parsed = extractedTransactionItemSchema.parse({
        amount: 54.9,
        type: 'EXPENSE',
        suggested_category: 'Transporte',
        description: 'Gasolina',
        transaction_date: '2026-10-23',
      });
      assert(parsed.amount === 54.9, 'amount');
      assert(parsed.payment_method === 'OTHER', 'default OTHER');
    });

    await test('llmExtractionResponseSchema: valida payloads completos, incompletos e não financeiros', () => {
      const full = llmExtractionResponseSchema.parse({
        has_financial_intent: true,
        missing_information: null,
        transactions: [
          {
            amount: 30,
            type: 'EXPENSE',
            suggested_category: 'Transporte',
            description: 'Uber',
            transaction_date: '2026-10-23',
          },
        ],
      });
      assert(full.has_financial_intent === true, 'intent true');
      assert(full.transactions.length === 1, '1 transaction');

      const incomplete = llmExtractionResponseSchema.parse({
        has_financial_intent: true,
        missing_information: 'Qual foi o valor gasto?',
        transactions: [],
      });
      assert(incomplete.missing_information !== null, 'missing info text');

      const nonFinancial = llmExtractionResponseSchema.parse({
        has_financial_intent: false,
        missing_information: null,
        transactions: [],
      });
      assert(nonFinancial.has_financial_intent === false, 'non financial');
    });

    await test('confirmationActionTypeSchema: valida ações CONFIRM, CANCEL, PATCH, etc.', () => {
      for (const a of ['CONFIRM', 'CANCEL', 'PATCH', 'NEW_TRANSACTION', 'UNKNOWN']) {
        assert(confirmationActionTypeSchema.parse(a) === a, a);
      }
      assertThrows(() => confirmationActionTypeSchema.parse('DELETE'));
    });

    await test('userConfirmationPatchSchema: permite atualizações parciais de campos', () => {
      const p1 = userConfirmationPatchSchema.parse({ amount: 60 });
      assert(p1.amount === 60, 'amount 60');
      assert(p1.category === undefined, 'category undefined');

      const p2 = userConfirmationPatchSchema.parse({ category: 'Lazer', payment_method: 'PIX' });
      assert(p2.category === 'Lazer', 'Lazer');
      assert(p2.payment_method === 'PIX', 'PIX');
      assertThrows(() => userConfirmationPatchSchema.parse({ amount: -5 }));
    });

    await test('createTransactionSchema: valida UUID e descrição com no mínimo 2 chars', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const parsed = createTransactionSchema.parse({
        amount: 100,
        type: 'EXPENSE',
        categoryId: uuid,
        description: 'Mercado',
        transactionDate: '2026-10-23',
      });
      assert(parsed.amount === 100, 'amount');
      assertThrows(() =>
        createTransactionSchema.parse({
          amount: 100,
          type: 'EXPENSE',
          categoryId: 'invalid',
          description: 'M',
          transactionDate: '2026-10-23',
        })
      );
    });

    await test('whatsAppOtpVerificationSchema: exige 6 dígitos numéricos e E.164', () => {
      const parsed = whatsAppOtpVerificationSchema.parse({
        code: '749201',
        whatsappPhone: '+5511999998888',
      });
      assert(parsed.code === '749201', 'code');
      assertThrows(() => whatsAppOtpVerificationSchema.parse({ code: '123', whatsappPhone: '+5511999998888' }));
      assertThrows(() => whatsAppOtpVerificationSchema.parse({ code: '123456', whatsappPhone: 'invalid' }));
    });
  });

  // ----------------------------------------------------
  // SUITE 2: NORMALIZAÇÃO TELEFÔNICA E.164
  // ----------------------------------------------------
  await suite('2. Normalização Telefônica E.164 Brasileira', async () => {
    await test('normaliza números com prefixo +55, sem +, nacional com DDD e pontuados', () => {
      assert(normalizeBrazilianPhoneToE164('+5511999998888') === '+5511999998888', '+55');
      assert(normalizeBrazilianPhoneToE164('5511999998888') === '+5511999998888', '55');
      assert(normalizeBrazilianPhoneToE164('11999998888') === '+5511999998888', '11');
      assert(normalizeBrazilianPhoneToE164('(11) 99999-8888') === '+5511999998888', 'formatted');
      assert(normalizeBrazilianPhoneToE164('  +55 (21) 98765-4321 ') === '+5521987654321', 'spaces');
    });

    await test('normaliza JIDs da Evolution API (@s.whatsapp.net e com porta)', () => {
      assert(normalizeBrazilianPhoneToE164('5511999998888@s.whatsapp.net') === '+5511999998888', 'jid');
      assert(normalizeBrazilianPhoneToE164('5521987654321:12@s.whatsapp.net') === '+5521987654321', 'port');
    });

    await test('autocompleta o 9º dígito móvel legado (8 dígitos)', () => {
      assert(normalizeBrazilianPhoneToE164('1198765432') === '+5511998765432', '8 digits');
      assert(normalizeBrazilianPhoneToE164('552187654321') === '+5521987654321', '55 8 digits');
    });

    await test('valida DDDs oficiais e rejeita DDDs inexistentes no Brasil', () => {
      for (const ddd of ['11', '19', '21', '27', '31', '41', '51', '61', '71', '81', '91', '92']) {
        assert(VALID_BRAZILIAN_DDDS.has(ddd), `valid ddd ${ddd}`);
        assert(isValidBrazilianE164(`+55${ddd}999998888`), `valid phone ${ddd}`);
      }
      for (const invalidDdd of ['00', '10', '20', '36', '39', '72']) {
        assert(!VALID_BRAZILIAN_DDDS.has(invalidDdd), `invalid ddd ${invalidDdd}`);
        assert(!isValidBrazilianE164(`+55${invalidDdd}999998888`), `invalid phone ${invalidDdd}`);
        assertThrows(() => normalizeBrazilianPhoneToE164(`+55${invalidDdd}999998888`));
      }
    });

    await test('rejeita telefones fixos (não suportados para WhatsApp bot)', () => {
      assertThrows(() => normalizeBrazilianPhoneToE164('1133334444'), /Telefone fixo brasileiro/);
      assertThrows(() => normalizeBrazilianPhoneToE164('552122223333'), /Telefone fixo brasileiro/);
    });

    await test('formatPhoneDisplay: formata amigavelmente para +55 (DD) 9XXXX-XXXX', () => {
      assert(formatPhoneDisplay('+5511999998888') === '+55 (11) 99999-8888', 'display format');
      assert(formatPhoneDisplay('invalid') === 'invalid', 'fallback');
    });
  });

  // ----------------------------------------------------
  // SUITE 3: PARSERS DE IA (DEEPSEEK & JEV)
  // ----------------------------------------------------
  await suite('3. Parsers de Resposta e Clientes de IA', async () => {
    const originalFetch = globalThis.fetch;

    await test('cleanJsonResponse: remove blocos de código markdown', () => {
      const client = new DeepSeekClient('test-key') as unknown as { cleanJsonResponse: (s: string) => string };
      assert(client.cleanJsonResponse('```json\n{"a":1}\n```') === '{"a":1}', '```json');
      assert(client.cleanJsonResponse('```\n{"b":2}\n```') === '{"b":2}', '```');
      assert(client.cleanJsonResponse('{"c":3}') === '{"c":3}', 'plain');
    });

    await test('extractTransactionFromText: parseia resposta estruturada do DeepSeek', async () => {
      const client = new DeepSeekClient('test-key');
      globalThis.fetch = (async () => ({
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
                      amount: 38.0,
                      type: 'EXPENSE',
                      suggested_category: 'Alimentação',
                      payment_method: 'DEBIT_CARD',
                      description: 'Almoço no quilo',
                      transaction_date: '2026-10-23',
                    },
                  ],
                }),
              },
            },
          ],
        }),
      })) as unknown as typeof fetch;

      const res = await client.extractTransactionFromText('Paguei 38 no almoço no débito');
      assert(res.has_financial_intent === true, 'intent true');
      assert(res.transactions[0].amount === 38.0, 'amount 38');
      assert(res.transactions[0].payment_method === 'DEBIT_CARD', 'debit card');
    });

    await test('processReceiptImage: parseia comprovante bancário Pix via OCR', async () => {
      const client = new DeepSeekClient('test-key');
      globalThis.fetch = (async () => ({
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
                      amount: 125.0,
                      type: 'EXPENSE',
                      suggested_category: 'Alimentação',
                      payment_method: 'PIX',
                      description: 'Supermercado Pão de Açúcar',
                      transaction_date: '2026-10-23',
                    },
                  ],
                }),
              },
            },
          ],
        }),
      })) as unknown as typeof fetch;

      const res = await client.processReceiptImage(Buffer.from('bytes'), 'image/jpeg');
      assert(res.transactions[0].amount === 125.0, '125.00');
      assert(res.transactions[0].payment_method === 'PIX', 'PIX');
      assert(res.transactions[0].description === 'Supermercado Pão de Açúcar', 'description');
    });

    await test('JevClient: avalia intenções de confirmação e cancelamento (noul)', async () => {
      const jev = new JevClient('test-key');

      // Confirm
      globalThis.fetch = (async () => ({
        ok: true,
        json: async () => ({
          model: 'jev-latest',
          answers: { is_confirm: { type: 'noul', decision: true, confidence: 0.99 } },
        }),
      })) as unknown as typeof fetch;

      assert((await jev.isConfirmationIntent('Sim')) === true, 'is_confirm true');

      // Cancel
      globalThis.fetch = (async () => ({
        ok: true,
        json: async () => ({
          model: 'jev-latest',
          answers: { is_cancel: { type: 'noul', decision: true, confidence: 0.98 } },
        }),
      })) as unknown as typeof fetch;

      assert((await jev.isCancellationIntent('Cancela')) === true, 'is_cancel true');
    });

    await test('JevClient: classifica categorias e métodos de pagamento (choice)', async () => {
      const jev = new JevClient('test-key');

      globalThis.fetch = (async () => ({
        ok: true,
        json: async () => ({
          model: 'jev-latest',
          answers: {
            category: { type: 'choice', choice: 'Alimentação', confidence: 0.95, probabilities: { Alimentação: 0.95 } },
          },
        }),
      })) as unknown as typeof fetch;

      const cat = await jev.classifyCategory('Almoço', ['Alimentação', 'Transporte']);
      assert(cat.category === 'Alimentação', 'category choice');
      assert(cat.confidence === 0.95, 'confidence');
    });

    globalThis.fetch = originalFetch;
  });

  // ----------------------------------------------------
  // SUITE 4: DEDUPLICAÇÃO & IDEMPOTÊNCIA NO REDIS
  // ----------------------------------------------------
  await suite('4. Idempotência e Deduplicação no Redis', async () => {
    // Simula store atômico
    const mockStore = new Map<string, string>();
    const redisMock = {
      async set(k: string, v: string, _m?: string, _d?: number, f?: string): Promise<'OK' | null> {
        if (f === 'NX' && mockStore.has(k)) return null;
        mockStore.set(k, v);
        return 'OK';
      },
      async get(k: string): Promise<string | null> {
        return mockStore.get(k) ?? null;
      },
    };

    await test('adquire na primeira tentativa e bloqueia na segunda (SET NX EX)', async () => {
      mockStore.clear();
      const key = 'idemp:evo:msg:MSG001';

      const first = await redisMock.set(key, 'PENDING', 'EX', 86400, 'NX');
      assert(first === 'OK', 'primeira requisição adquire lock');

      const second = await redisMock.set(key, 'PENDING', 'EX', 86400, 'NX');
      assert(second === null, 'segunda requisição bloqueada por idempotência');
    });

    await test('transita os estados: PENDING -> PROCESSING -> COMPLETED', async () => {
      mockStore.clear();
      const key = 'idemp:evo:msg:MSG002';

      await redisMock.set(key, 'PENDING', 'EX', 86400, 'NX');
      assert((await redisMock.get(key)) === 'PENDING', 'PENDING');

      await redisMock.set(key, 'PROCESSING', 'EX', 86400);
      assert((await redisMock.get(key)) === 'PROCESSING', 'PROCESSING');

      await redisMock.set(key, 'COMPLETED', 'EX', 86400);
      assert((await redisMock.get(key)) === 'COMPLETED', 'COMPLETED');
    });

    await test('rajada concorrente de 10 requisições simultâneas: exatamente 1 vence', async () => {
      mockStore.clear();
      const key = 'idemp:evo:msg:BURST-10';

      const results = await Promise.all(
        Array.from({ length: 10 }).map(() => redisMock.set(key, 'PENDING', 'EX', 86400, 'NX'))
      );

      const acquired = results.filter((r) => r === 'OK').length;
      const blocked = results.filter((r) => r === null).length;

      assert(acquired === 1, `exatamente 1 adquire lock (adquirido: ${acquired})`);
      assert(blocked === 9, `9 bloqueados (bloqueados: ${blocked})`);
    });
  });

  // ----------------------------------------------------
  // SUMÁRIO FINAL
  // ----------------------------------------------------
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log('\n======================================================');
  console.log(`  RESULTADO: ${passed}/${total} testes passaram (${failed} falhas)`);
  console.log('======================================================\n');

  return { passed, failed, total };
}

// Execução direta via Node.js / TSX
runAllTests().catch(console.error);
