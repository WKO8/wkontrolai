/**
 * WKontrolAI — Testes de Integração das Rotas de Transações e Chat IA
 * Valida os endpoints PATCH /api/transactions, DELETE /api/transactions e POST /api/ai/chat:
 * - Atualizações parciais e completas com persistência e enriquecimento
 * - Isolamento estrito Multi-Tenant e proteção contra vulnerabilidade IDOR
 * - Validações de entrada Zod (payloads negativos, nulos, UUIDs inválidos)
 * - RAG Retrieval do Chat IA com isolamento de tenant no contexto financeiro
 * - Registro e conformidade de logs de auditoria (US-07)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH, DELETE } from '@/app/api/transactions/route';
import { POST as chatPOST } from '@/app/api/ai/chat/route';

// Definições de tipos para os mocks em memória
interface MockTransaction {
  id: string;
  tenantId: string;
  userId: string;
  categoryId: string;
  type: 'EXPENSE' | 'INCOME';
  amount: string;
  description: string;
  paymentMethod: string;
  transactionDate: string;
  sourceChannel: string;
  confirmedByUser: boolean;
  rawPayload: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockCategory {
  id: string;
  tenantId: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: 'EXPENSE' | 'INCOME';
}

interface MockTenant {
  id: string;
  ownerId: string;
  name: string;
}

interface MockUser {
  id: string;
  name: string;
  email: string;
  whatsappPhone: string | null;
}

interface MockAuditLog {
  tenantId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
}

// Configuração do Mock Hoisted para o Banco de Dados e DeepSeek
const {
  mockTransactions,
  mockCategories,
  mockTenants,
  mockUsers,
  mockAuditLogs,
  mockDeepSeekCalls,
} = vi.hoisted(() => {
  return {
    mockTransactions: [] as MockTransaction[],
    mockCategories: [] as MockCategory[],
    mockTenants: [] as MockTenant[],
    mockUsers: [] as MockUser[],
    mockAuditLogs: [] as MockAuditLog[],
    mockDeepSeekCalls: [] as Array<{ message: string; financialContext: string }>,
  };
});

// Helper para extrair condições dos nós SQL do Drizzle
function extractConditions(sqlObj: unknown): Array<{ col: string; val: unknown }> {
  const conds: Array<{ col: string; val: unknown }> = [];
  let currentCol: string | null = null;

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;

    if (Array.isArray(n.queryChunks)) {
      for (const chunk of n.queryChunks) walk(chunk);
    } else if (n.name && typeof n.name === 'string') {
      currentCol = n.name;
    } else if (n.value !== undefined && n.encoder && currentCol) {
      conds.push({ col: currentCol, val: n.value });
      currentCol = null;
    } else if (Array.isArray(n.value)) {
      for (const sub of n.value) walk(sub);
    }
  }

  walk(sqlObj);
  return conds;
}

// Mock do Drizzle ORM (@/lib/db)
vi.mock('@/lib/db', () => {
  return {
    db: {
      select: (selectFields?: unknown) => {
        let currentTable = '';
        let leftJoinTable = '';
        let conditions: Array<{ col: string; val: unknown }> = [];
        let limitCount: number | null = null;

        const qb = {
          from: (table: unknown) => {
            currentTable = ((table as Record<symbol, unknown>)?.[Symbol.for('drizzle:Name')] as string) || '';
            return qb;
          },
          leftJoin: (table: unknown) => {
            leftJoinTable = ((table as Record<symbol, unknown>)?.[Symbol.for('drizzle:Name')] as string) || '';
            return qb;
          },
          where: (cond: unknown) => {
            conditions = extractConditions(cond);
            return qb;
          },
          orderBy: () => qb,
          limit: (n: number) => {
            limitCount = n;
            return qb;
          },
          then: (onfulfilled?: (val: unknown) => unknown, onrejected?: (val: unknown) => unknown) => {
            try {
              let results: unknown[] = [];

              if (currentTable === 'transactions') {
                let filtered = mockTransactions.filter((tx) => {
                  for (const c of conditions) {
                    if (c.col === 'id' && tx.id !== c.val) return false;
                    if (c.col === 'tenant_id' && tx.tenantId !== c.val) return false;
                    if (c.col === 'category_id' && tx.categoryId !== c.val) return false;
                    if (c.col === 'transaction_date' && tx.transactionDate < (c.val as string)) return false;
                  }
                  return true;
                });

                if (leftJoinTable === 'categories' || (selectFields && typeof selectFields === 'object' && 'tx' in selectFields)) {
                  results = filtered.map((tx) => {
                    const cat = mockCategories.find((c) => c.id === tx.categoryId) || null;
                    return { tx, cat };
                  });
                } else {
                  results = filtered;
                }
              } else if (currentTable === 'categories') {
                results = mockCategories.filter((cat) => {
                  for (const c of conditions) {
                    if (c.col === 'id' && cat.id !== c.val) return false;
                    if (c.col === 'tenant_id' && cat.tenantId !== c.val) return false;
                  }
                  return true;
                });
              } else if (currentTable === 'tenants') {
                results = mockTenants.filter((tenant) => {
                  for (const c of conditions) {
                    if (c.col === 'id' && tenant.id !== c.val) return false;
                    if (c.col === 'owner_id' && tenant.ownerId !== c.val) return false;
                  }
                  return true;
                });
              } else if (currentTable === 'users') {
                results = mockUsers.filter((user) => {
                  for (const c of conditions) {
                    if (c.col === 'id' && user.id !== c.val) return false;
                    if (c.col === 'whatsapp_phone' && user.whatsappPhone !== c.val) return false;
                  }
                  return true;
                });
              }

              if (limitCount !== null) {
                results = results.slice(0, limitCount);
              }

              return Promise.resolve(results).then(onfulfilled, onrejected);
            } catch (err) {
              return Promise.reject(err).then(onfulfilled, onrejected);
            }
          },
        };

        return qb;
      },

      update: (table: unknown) => {
        const tableName = ((table as Record<symbol, unknown>)?.[Symbol.for('drizzle:Name')] as string) || '';
        let updateValues: Record<string, unknown> = {};
        let conditions: Array<{ col: string; val: unknown }> = [];

        return {
          set: (vals: Record<string, unknown>) => {
            updateValues = vals;
            return {
              where: (cond: unknown) => {
                conditions = extractConditions(cond);
                return {
                  returning: () => {
                    if (tableName === 'transactions') {
                      const updatedRows: MockTransaction[] = [];
                      for (const tx of mockTransactions) {
                        let match = true;
                        for (const c of conditions) {
                          if (c.col === 'id' && tx.id !== c.val) match = false;
                          if (c.col === 'tenant_id' && tx.tenantId !== c.val) match = false;
                        }
                        if (match) {
                          if (updateValues.amount !== undefined) tx.amount = String(updateValues.amount);
                          if (updateValues.description !== undefined) tx.description = String(updateValues.description);
                          if (updateValues.type !== undefined) tx.type = updateValues.type as 'EXPENSE' | 'INCOME';
                          if (updateValues.categoryId !== undefined) tx.categoryId = String(updateValues.categoryId);
                          if (updateValues.paymentMethod !== undefined) tx.paymentMethod = String(updateValues.paymentMethod);
                          if (updateValues.transactionDate !== undefined) tx.transactionDate = String(updateValues.transactionDate);
                          if (updateValues.metadata !== undefined) tx.metadata = updateValues.metadata as Record<string, unknown> | null;
                          tx.updatedAt = new Date();
                          updatedRows.push({ ...tx });
                        }
                      }
                      return Promise.resolve(updatedRows);
                    }
                    return Promise.resolve([]);
                  },
                };
              },
            };
          },
        };
      },

      delete: (table: unknown) => {
        const tableName = ((table as Record<symbol, unknown>)?.[Symbol.for('drizzle:Name')] as string) || '';
        return {
          where: (cond: unknown) => {
            const conditions = extractConditions(cond);
            if (tableName === 'transactions') {
              for (let i = mockTransactions.length - 1; i >= 0; i--) {
                const tx = mockTransactions[i];
                let match = true;
                for (const c of conditions) {
                  if (c.col === 'id' && tx.id !== c.val) match = false;
                  if (c.col === 'tenant_id' && tx.tenantId !== c.val) match = false;
                }
                if (match) {
                  mockTransactions.splice(i, 1);
                }
              }
            }
            return Promise.resolve({ rowCount: 1 });
          },
        };
      },

      insert: (table: unknown) => {
        const tableName = ((table as Record<symbol, unknown>)?.[Symbol.for('drizzle:Name')] as string) || '';
        return {
          values: (vals: unknown) => {
            if (tableName === 'audit_logs') {
              mockAuditLogs.push(vals as MockAuditLog);
            }
            return Promise.resolve({ rowCount: 1 });
          },
        };
      },
    },
  };
});

// Mock da LLM DeepSeek
vi.mock('@/lib/ai/deepseek', () => {
  return {
    deepseek: {
      chatFinancialAssistant: vi.fn(async (message: string, financialContext: string) => {
        mockDeepSeekCalls.push({ message, financialContext });
        return `[DeepSeek Mock]: Análise concluída com base nos dados reais do usuário. Mensagem: "${message}"`;
      }),
    },
  };
});

// Mock do Redis Rate Limiter
vi.mock('@/lib/queue/redis', () => {
  return {
    redis: {
      incr: vi.fn(async () => 1),
      expire: vi.fn(async () => 1),
      get: vi.fn(async () => null),
      set: vi.fn(async () => 'OK'),
      del: vi.fn(async () => 1),
    },
  };
});

describe('Integração de Rotas: PATCH /api/transactions, DELETE /api/transactions e POST /api/ai/chat', () => {
  // Constantes de Tenant e IDs de Teste
  const TENANT_A_ID = '11111111-1111-4111-a111-111111111111';
  const TENANT_B_ID = '22222222-2222-4222-a222-222222222222';
  const USER_A_ID = '33333333-3333-4333-a333-333333333333';
  const USER_B_ID = '44444444-4444-4444-a444-444444444444';

  const CAT_A_ALIMENTACAO = '55555555-5555-4555-a555-555555555551';
  const CAT_A_TRANSPORTE = '55555555-5555-4555-a555-555555555552';
  const CAT_B_MORADIA = '66666666-6666-4666-a666-666666666661';

  const TX_A_ALMOCO = '77777777-7777-4777-a777-777777777771';
  const TX_A_UBER = '77777777-7777-4777-a777-777777777772';
  const TX_B_ALUGUEL = '88888888-8888-4888-a888-888888888881';

  beforeEach(() => {
    // Limpa estado dos mocks
    mockTransactions.length = 0;
    mockCategories.length = 0;
    mockTenants.length = 0;
    mockUsers.length = 0;
    mockAuditLogs.length = 0;
    mockDeepSeekCalls.length = 0;
    vi.clearAllMocks();

    // Semeia Usuários e Tenants
    mockUsers.push(
      { id: USER_A_ID, name: 'Alice Silva', email: 'alice@wkontrol.ai', whatsappPhone: '+5511999991111' },
      { id: USER_B_ID, name: 'Bob Souza', email: 'bob@wkontrol.ai', whatsappPhone: '+5511999992222' }
    );

    mockTenants.push(
      { id: TENANT_A_ID, ownerId: USER_A_ID, name: 'Finanças Alice' },
      { id: TENANT_B_ID, ownerId: USER_B_ID, name: 'Finanças Bob' }
    );

    // Semeia Categorias dos Tenants
    mockCategories.push(
      { id: CAT_A_ALIMENTACAO, tenantId: TENANT_A_ID, name: 'Alimentação', icon: 'utensils', color: '#f97316', type: 'EXPENSE' },
      { id: CAT_A_TRANSPORTE, tenantId: TENANT_A_ID, name: 'Transporte', icon: 'car', color: '#3b82f6', type: 'EXPENSE' },
      { id: CAT_B_MORADIA, tenantId: TENANT_B_ID, name: 'Moradia', icon: 'home', color: '#10b981', type: 'EXPENSE' }
    );

    // Semeia Transações de Tenant A e Tenant B
    mockTransactions.push(
      {
        id: TX_A_ALMOCO,
        tenantId: TENANT_A_ID,
        userId: USER_A_ID,
        categoryId: CAT_A_ALIMENTACAO,
        type: 'EXPENSE',
        amount: '45.00',
        description: 'Almoço no restaurante',
        paymentMethod: 'DEBIT_CARD',
        transactionDate: '2026-10-24',
        sourceChannel: 'WEB_DASHBOARD',
        confirmedByUser: true,
        rawPayload: null,
        metadata: null,
        createdAt: new Date('2026-10-24T12:00:00Z'),
        updatedAt: new Date('2026-10-24T12:00:00Z'),
      },
      {
        id: TX_A_UBER,
        tenantId: TENANT_A_ID,
        userId: USER_A_ID,
        categoryId: CAT_A_TRANSPORTE,
        type: 'EXPENSE',
        amount: '28.50',
        description: 'Corrida de Uber',
        paymentMethod: 'PIX',
        transactionDate: '2026-10-24',
        sourceChannel: 'WHATSAPP_TEXT',
        confirmedByUser: true,
        rawPayload: 'Uber 28.50 pix',
        metadata: null,
        createdAt: new Date('2026-10-24T14:30:00Z'),
        updatedAt: new Date('2026-10-24T14:30:00Z'),
      },
      {
        id: TX_B_ALUGUEL,
        tenantId: TENANT_B_ID,
        userId: USER_B_ID,
        categoryId: CAT_B_MORADIA,
        type: 'EXPENSE',
        amount: '2500.00',
        description: 'Aluguel Apartamento Bob',
        paymentMethod: 'BANK_TRANSFER',
        transactionDate: '2026-10-20',
        sourceChannel: 'WEB_DASHBOARD',
        confirmedByUser: true,
        rawPayload: null,
        metadata: null,
        createdAt: new Date('2026-10-20T10:00:00Z'),
        updatedAt: new Date('2026-10-20T10:00:00Z'),
      }
    );
  });

  // ==========================================
  // 1. TESTES DE PATCH /api/transactions
  // ==========================================
  describe('1. PATCH /api/transactions', () => {
    it('deve atualizar com sucesso descrição, valor, categoria, método de pagamento e data da transação própria', async () => {
      const payload = {
        id: TX_A_ALMOCO,
        tenantId: TENANT_A_ID,
        description: 'Almoço Executivo de Negócios',
        amount: 85.5,
        categoryId: CAT_A_TRANSPORTE, // Muda categoria dentro do mesmo tenant
        paymentMethod: 'CREDIT_CARD',
        transactionDate: '2026-10-25',
      };

      const req = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await PATCH(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.id).toBe(TX_A_ALMOCO);
      expect(json.description).toBe('Almoço Executivo de Negócios');
      expect(json.amount).toBe('85.50');
      expect(json.paymentMethod).toBe('CREDIT_CARD');
      expect(json.transactionDate).toBe('2026-10-25');
      expect(json.categoryId).toBe(CAT_A_TRANSPORTE);
      expect(json.categoryName).toBe('Transporte');

      // Verifica persistência no store em memória
      const inMemory = mockTransactions.find((t) => t.id === TX_A_ALMOCO);
      expect(inMemory?.description).toBe('Almoço Executivo de Negócios');
      expect(inMemory?.amount).toBe('85.50');

      // Verifica se log de auditoria foi emitido
      const audit = mockAuditLogs.find(
        (a) => a.action === 'TRANSACTION_EDITED' && a.entityId === TX_A_ALMOCO
      );
      expect(audit).toBeDefined();
      expect(audit?.tenantId).toBe(TENANT_A_ID);
    });

    it('deve rejeitar tentativa de atualização de transação pertencente a outro tenant (IDOR) com HTTP 404 (anti-enumeração)', async () => {
      // Usuário/Tenant A tenta atualizar a transação de Aluguel que pertence a Bob (Tenant B)
      const payload = {
        id: TX_B_ALUGUEL,
        tenantId: TENANT_A_ID,
        description: 'Hackeando aluguel do Bob',
        amount: 1.0,
      };

      const req = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await PATCH(req);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toContain('Transação não encontrada ou não pertencente ao seu workspace');

      // Garante que a transação de Bob NÃO foi alterada
      const inMemory = mockTransactions.find((t) => t.id === TX_B_ALUGUEL);
      expect(inMemory?.amount).toBe('2500.00');
      expect(inMemory?.description).toBe('Aluguel Apartamento Bob');
    });

    it('deve rejeitar requisição sem autorização de tenant ou telefone com HTTP 401', async () => {
      const payload = {
        id: TX_A_ALMOCO,
        description: 'Sem tenantId ou phone',
      };

      const req = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await PATCH(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toContain('Tenant ou telefone pareado é obrigatório');
    });

    it('deve rejeitar categoria pertencente a outro tenant com HTTP 400', async () => {
      // Transação pertence a Tenant A, mas categoryId aponta para Moradia (Tenant B)
      const payload = {
        id: TX_A_ALMOCO,
        tenantId: TENANT_A_ID,
        categoryId: CAT_B_MORADIA,
      };

      const req = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await PATCH(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain('Categoria informada não encontrada no workspace');
    });

    it('deve retornar HTTP 404 quando a transação informada não existir', async () => {
      const payload = {
        id: '99999999-9999-4999-a999-999999999999',
        tenantId: TENANT_A_ID,
        description: 'Transação Fantasma',
      };

      const req = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await PATCH(req);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toContain('Transação não encontrada ou não pertencente ao seu workspace');
    });

    it('deve rejeitar payload inválido (valor negativo, zero ou UUID inválido) com HTTP 400', async () => {
      // Valor negativo
      const invalidAmountReq = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: TX_A_ALMOCO,
          amount: -50.0,
        }),
      });
      const resAmount = await PATCH(invalidAmountReq);
      expect(resAmount.status).toBe(400);

      // UUID inválido
      const invalidUuidReq = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: 'nao-e-um-uuid',
          amount: 50.0,
        }),
      });
      const resUuid = await PATCH(invalidUuidReq);
      expect(resUuid.status).toBe(400);
    });
  });

  // ==========================================
  // 2. TESTES DE DELETE /api/transactions
  // ==========================================
  describe('2. DELETE /api/transactions', () => {
    it('deve excluir com sucesso transação própria via searchParams com HTTP 200 e log de auditoria', async () => {
      const url = `http://localhost:3000/api/transactions?id=${TX_A_UBER}&tenantId=${TENANT_A_ID}`;
      const req = new NextRequest(url, { method: 'DELETE' });

      const res = await DELETE(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.deletedId).toBe(TX_A_UBER);

      // Garante remoção do banco em memória
      expect(mockTransactions.some((t) => t.id === TX_A_UBER)).toBe(false);

      // Garante registro no log de auditoria
      const audit = mockAuditLogs.find(
        (a) => a.action === 'TRANSACTION_DELETED' && a.entityId === TX_A_UBER
      );
      expect(audit).toBeDefined();
      expect(audit?.tenantId).toBe(TENANT_A_ID);
      expect(audit?.metadata.deletedAmount).toBe('28.50');
    });

    it('deve excluir com sucesso transação própria via body JSON com HTTP 200', async () => {
      const req = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: TX_A_ALMOCO, tenantId: TENANT_A_ID }),
      });

      const res = await DELETE(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.deletedId).toBe(TX_A_ALMOCO);

      expect(mockTransactions.some((t) => t.id === TX_A_ALMOCO)).toBe(false);
    });

    it('deve rejeitar tentativa de exclusão de transação de outro tenant (IDOR) com HTTP 404 (anti-enumeração)', async () => {
      // Alice (Tenant A) tenta deletar transação de Aluguel de Bob (Tenant B)
      const url = `http://localhost:3000/api/transactions?id=${TX_B_ALUGUEL}&tenantId=${TENANT_A_ID}`;
      const req = new NextRequest(url, { method: 'DELETE' });

      const res = await DELETE(req);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toContain('Transação não encontrada ou não pertencente ao seu workspace');

      // Garante que a transação de Bob permanece intacta
      expect(mockTransactions.some((t) => t.id === TX_B_ALUGUEL)).toBe(true);
    });

    it('deve retornar HTTP 404 ao tentar excluir transação com ID inexistente', async () => {
      const url = `http://localhost:3000/api/transactions?id=99999999-9999-4999-a999-999999999999&tenantId=${TENANT_A_ID}`;
      const req = new NextRequest(url, { method: 'DELETE' });

      const res = await DELETE(req);
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toContain('Transação não encontrada ou não pertencente ao seu workspace');
    });

    it('deve retornar HTTP 400 quando nenhum ID for informado para exclusão', async () => {
      const req = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'DELETE',
      });

      const res = await DELETE(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain('ID da transação é obrigatório');
    });
  });

  // ==========================================
  // 3. TESTES DE POST /api/ai/chat
  // ==========================================
  describe('3. POST /api/ai/chat', () => {
    it('deve rejeitar mensagem vazia ou contendo apenas espaços com HTTP 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: '   ', tenantId: TENANT_A_ID }),
      });

      const res = await chatPOST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain('Parâmetros de chat inválidos');
    });

    it('deve rejeitar mensagem excessivamente longa (> 1000 caracteres) com HTTP 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: 'análise financeira detalhada '.repeat(50), // > 1000 chars
          tenantId: TENANT_A_ID,
        }),
      });

      const res = await chatPOST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain('Parâmetros de chat inválidos');
    });

    it('deve garantir isolamento estrito de tenant na montagem do contexto financeiro RAG', async () => {
      // Faz requisição de chat para Tenant A (Alice)
      const req = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: 'Quanto gastei no total nos últimos dias?',
          tenantId: TENANT_A_ID,
        }),
      });

      const res = await chatPOST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.metrics).toBeDefined();

      // Métricas devem contemplar APENAS as despesas de Alice (45.00 + 28.50 = 73.50)
      expect(json.metrics.totalExpense).toBe(73.5);
      expect(json.metrics.transactionCount).toBe(2);

      // Verifica se a chamada à DeepSeek foi realizada com o contexto correto
      expect(mockDeepSeekCalls.length).toBe(1);
      const call = mockDeepSeekCalls[0];
      expect(call.message).toBe('Quanto gastei no total nos últimos dias?');

      // O contexto financeiro RAG deve conter os dados de Alice:
      expect(call.financialContext).toContain('Almoço no restaurante');
      expect(call.financialContext).toContain('Corrida de Uber');
      expect(call.financialContext).toMatch(/73,50/);

      // E RIGOROSAMENTE NÃO DEVE CONTER dados do Tenant B (Bob):
      expect(call.financialContext).not.toContain('Aluguel Apartamento Bob');
      expect(call.financialContext).not.toContain('2500');
    });

    it('deve retornar resposta orientativa amigável quando nenhum tenant estiver cadastrado', async () => {
      // Limpa tenants
      mockTenants.length = 0;

      const req = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: 'Qual é o meu saldo?',
        }),
      });

      const res = await chatPOST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.reply).toContain('Não localizamos uma conta ativa');
    });
  });
});
