/**
 * WKontrolAI — Script Canônico de Seed do Banco de Dados
 * Popula o PostgreSQL com usuário de demonstração, tenant, categorias e transações realistas
 * Para execução local: pnpm db:seed
 */

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, client } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { DEFAULT_TENANT_CATEGORIES } from '@/lib/validations/auth';
import type { PaymentMethod, SourceChannel, TransactionType, InsightType } from '@/types';

interface SeedTransaction {
  description: string;
  amount: string;
  type: TransactionType;
  categoryName: string;
  paymentMethod: PaymentMethod;
  transactionDate: string;
  sourceChannel: SourceChannel;
}

const DEMO_USER_PHONE = '+5511999999999';
const DEMO_USER_EMAIL = 'demo@wkontrol.local';
const DEMO_USER_NAME = 'Usuário Demo';

const SEED_TRANSACTIONS: SeedTransaction[] = [
  // ==========================================
  // OUTUBRO 2026 (Mês Atual do Dashboard)
  // ==========================================
  {
    description: 'Salário CLT Mensal — Tech Corp',
    amount: '6800.00',
    type: 'INCOME',
    categoryName: 'Salário & Renda',
    paymentMethod: 'PIX',
    transactionDate: '2026-10-05',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Consultoria Backend & DevOps (Freelance)',
    amount: '2450.00',
    type: 'INCOME',
    categoryName: 'Freelances / Extras',
    paymentMethod: 'PIX',
    transactionDate: '2026-10-15',
    sourceChannel: 'WHATSAPP_TEXT',
  },
  {
    description: 'Rendimento CDB 110% CDI',
    amount: '182.40',
    type: 'INCOME',
    categoryName: 'Salário & Renda',
    paymentMethod: 'BANK_TRANSFER',
    transactionDate: '2026-10-25',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Aluguel do Apartamento e Condomínio',
    amount: '2100.00',
    type: 'EXPENSE',
    categoryName: 'Moradia & Contas',
    paymentMethod: 'PIX',
    transactionDate: '2026-10-06',
    sourceChannel: 'WHATSAPP_TEXT',
  },
  {
    description: 'Conta de Energia Elétrica — Enel',
    amount: '185.40',
    type: 'EXPENSE',
    categoryName: 'Moradia & Contas',
    paymentMethod: 'PIX',
    transactionDate: '2026-10-08',
    sourceChannel: 'WHATSAPP_TEXT',
  },
  {
    description: 'Internet Fibra Óptica 600MB',
    amount: '129.90',
    type: 'EXPENSE',
    categoryName: 'Moradia & Contas',
    paymentMethod: 'DEBIT_CARD',
    transactionDate: '2026-10-10',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Supermercado Pão de Açúcar (Compras do mês)',
    amount: '842.65',
    type: 'EXPENSE',
    categoryName: 'Alimentação & Mercado',
    paymentMethod: 'CREDIT_CARD',
    transactionDate: '2026-10-10',
    sourceChannel: 'WHATSAPP_AUDIO',
  },
  {
    description: 'Abastecimento Gasolina Comum — Posto Shell',
    amount: '260.00',
    type: 'EXPENSE',
    categoryName: 'Transporte & Combustível',
    paymentMethod: 'DEBIT_CARD',
    transactionDate: '2026-10-12',
    sourceChannel: 'WHATSAPP_AUDIO',
  },
  {
    description: 'Farmácia Drogasil — Vitaminas & Higiene',
    amount: '115.80',
    type: 'EXPENSE',
    categoryName: 'Saúde & Farmácia',
    paymentMethod: 'CREDIT_CARD',
    transactionDate: '2026-10-14',
    sourceChannel: 'WHATSAPP_IMAGE',
  },
  {
    description: 'Feira Livre semanal — Frutas & Verduras',
    amount: '78.50',
    type: 'EXPENSE',
    categoryName: 'Alimentação & Mercado',
    paymentMethod: 'PIX',
    transactionDate: '2026-10-16',
    sourceChannel: 'WHATSAPP_AUDIO',
  },
  {
    description: 'Jantar Restaurante Italiano Famiglia',
    amount: '195.00',
    type: 'EXPENSE',
    categoryName: 'Alimentação & Mercado',
    paymentMethod: 'CREDIT_CARD',
    transactionDate: '2026-10-18',
    sourceChannel: 'WHATSAPP_TEXT',
  },
  {
    description: 'Assinaturas Netflix 4K, Spotify & iCloud',
    amount: '94.80',
    type: 'EXPENSE',
    categoryName: 'Lazer & Assinaturas',
    paymentMethod: 'CREDIT_CARD',
    transactionDate: '2026-10-20',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Corrida Uber Comfort — Reunião externa',
    amount: '48.90',
    type: 'EXPENSE',
    categoryName: 'Transporte & Combustível',
    paymentMethod: 'CREDIT_CARD',
    transactionDate: '2026-10-22',
    sourceChannel: 'WHATSAPP_TEXT',
  },
  {
    description: 'Almoço Executivo Restaurante Grill',
    amount: '42.50',
    type: 'EXPENSE',
    categoryName: 'Alimentação & Mercado',
    paymentMethod: 'DEBIT_CARD',
    transactionDate: '2026-10-24',
    sourceChannel: 'WHATSAPP_TEXT',
  },
  {
    description: 'Troca de Pastilhas de Freio e Alinhamento',
    amount: '380.00',
    type: 'EXPENSE',
    categoryName: 'Transporte & Combustível',
    paymentMethod: 'PIX',
    transactionDate: '2026-10-26',
    sourceChannel: 'WHATSAPP_AUDIO',
  },
  {
    description: 'Cinema IMAX — 2 Ingressos + Combo Pipoca',
    amount: '68.00',
    type: 'EXPENSE',
    categoryName: 'Lazer & Assinaturas',
    paymentMethod: 'DEBIT_CARD',
    transactionDate: '2026-10-27',
    sourceChannel: 'WHATSAPP_TEXT',
  },
  {
    description: 'Padaria Artesanal — Café da manhã e pães',
    amount: '24.50',
    type: 'EXPENSE',
    categoryName: 'Alimentação & Mercado',
    paymentMethod: 'CASH',
    transactionDate: '2026-10-28',
    sourceChannel: 'WHATSAPP_AUDIO',
  },
  {
    description: 'Livro Técnico — Designing Data-Intensive Apps',
    amount: '139.90',
    type: 'EXPENSE',
    categoryName: 'Outros',
    paymentMethod: 'CREDIT_CARD',
    transactionDate: '2026-10-29',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Delivery Pizza Artesanal Napolitana',
    amount: '89.00',
    type: 'EXPENSE',
    categoryName: 'Alimentação & Mercado',
    paymentMethod: 'PIX',
    transactionDate: '2026-10-30',
    sourceChannel: 'WHATSAPP_TEXT',
  },

  // ==========================================
  // SETEMBRO 2026
  // ==========================================
  {
    description: 'Salário CLT Mensal — Tech Corp',
    amount: '6800.00',
    type: 'INCOME',
    categoryName: 'Salário & Renda',
    paymentMethod: 'PIX',
    transactionDate: '2026-09-05',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Desenvolvimento API de Pagamentos (Freela)',
    amount: '1900.00',
    type: 'INCOME',
    categoryName: 'Freelances / Extras',
    paymentMethod: 'PIX',
    transactionDate: '2026-09-18',
    sourceChannel: 'WHATSAPP_TEXT',
  },
  {
    description: 'Aluguel do Apartamento e Condomínio',
    amount: '2100.00',
    type: 'EXPENSE',
    categoryName: 'Moradia & Contas',
    paymentMethod: 'PIX',
    transactionDate: '2026-09-06',
    sourceChannel: 'WHATSAPP_TEXT',
  },
  {
    description: 'Conta de Energia Elétrica — Enel',
    amount: '174.30',
    type: 'EXPENSE',
    categoryName: 'Moradia & Contas',
    paymentMethod: 'PIX',
    transactionDate: '2026-09-08',
    sourceChannel: 'WHATSAPP_TEXT',
  },
  {
    description: 'Internet Fibra 600MB',
    amount: '129.90',
    type: 'EXPENSE',
    categoryName: 'Moradia & Contas',
    paymentMethod: 'DEBIT_CARD',
    transactionDate: '2026-09-10',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Compras Hipermercado Carrefour',
    amount: '789.10',
    type: 'EXPENSE',
    categoryName: 'Alimentação & Mercado',
    paymentMethod: 'CREDIT_CARD',
    transactionDate: '2026-09-09',
    sourceChannel: 'WHATSAPP_AUDIO',
  },
  {
    description: 'Abastecimento Gasolina — Posto Ipiranga',
    amount: '245.00',
    type: 'EXPENSE',
    categoryName: 'Transporte & Combustível',
    paymentMethod: 'DEBIT_CARD',
    transactionDate: '2026-09-13',
    sourceChannel: 'WHATSAPP_AUDIO',
  },
  {
    description: 'Consulta Oftalmológica de Rotina',
    amount: '220.00',
    type: 'EXPENSE',
    categoryName: 'Saúde & Farmácia',
    paymentMethod: 'PIX',
    transactionDate: '2026-09-15',
    sourceChannel: 'WHATSAPP_TEXT',
  },
  {
    description: 'Assinaturas de Streaming e Mídia',
    amount: '94.80',
    type: 'EXPENSE',
    categoryName: 'Lazer & Assinaturas',
    paymentMethod: 'CREDIT_CARD',
    transactionDate: '2026-09-20',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Uber ida e volta Centro da Cidade',
    amount: '34.20',
    type: 'EXPENSE',
    categoryName: 'Transporte & Combustível',
    paymentMethod: 'CREDIT_CARD',
    transactionDate: '2026-09-22',
    sourceChannel: 'WHATSAPP_TEXT',
  },
  {
    description: 'Show acústico no pub e consumação',
    amount: '160.00',
    type: 'EXPENSE',
    categoryName: 'Lazer & Assinaturas',
    paymentMethod: 'PIX',
    transactionDate: '2026-09-26',
    sourceChannel: 'WHATSAPP_AUDIO',
  },
  {
    description: 'Padaria — Lanches rápidos',
    amount: '56.00',
    type: 'EXPENSE',
    categoryName: 'Alimentação & Mercado',
    paymentMethod: 'CASH',
    transactionDate: '2026-09-28',
    sourceChannel: 'WHATSAPP_TEXT',
  },

  // ==========================================
  // AGOSTO 2026
  // ==========================================
  {
    description: 'Salário CLT Mensal — Tech Corp',
    amount: '6800.00',
    type: 'INCOME',
    categoryName: 'Salário & Renda',
    paymentMethod: 'PIX',
    transactionDate: '2026-08-05',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Participação nos Lucros (PLR / Bônus)',
    amount: '2200.00',
    type: 'INCOME',
    categoryName: 'Salário & Renda',
    paymentMethod: 'BANK_TRANSFER',
    transactionDate: '2026-08-14',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Aluguel do Apartamento e Condomínio',
    amount: '2100.00',
    type: 'EXPENSE',
    categoryName: 'Moradia & Contas',
    paymentMethod: 'PIX',
    transactionDate: '2026-08-06',
    sourceChannel: 'WHATSAPP_TEXT',
  },
  {
    description: 'Conta de Energia Elétrica',
    amount: '168.90',
    type: 'EXPENSE',
    categoryName: 'Moradia & Contas',
    paymentMethod: 'PIX',
    transactionDate: '2026-08-08',
    sourceChannel: 'WHATSAPP_TEXT',
  },
  {
    description: 'Supermercado Mensal Pão de Açúcar',
    amount: '810.40',
    type: 'EXPENSE',
    categoryName: 'Alimentação & Mercado',
    paymentMethod: 'CREDIT_CARD',
    transactionDate: '2026-08-10',
    sourceChannel: 'WHATSAPP_IMAGE',
  },
  {
    description: 'Combustível — Gasolina e Etanol',
    amount: '250.00',
    type: 'EXPENSE',
    categoryName: 'Transporte & Combustível',
    paymentMethod: 'DEBIT_CARD',
    transactionDate: '2026-08-12',
    sourceChannel: 'WHATSAPP_AUDIO',
  },
  {
    description: 'Exames Laboratoriais Check-up',
    amount: '140.00',
    type: 'EXPENSE',
    categoryName: 'Saúde & Farmácia',
    paymentMethod: 'DEBIT_CARD',
    transactionDate: '2026-08-18',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Passeio fim de semana — Pedágio e Alimentação',
    amount: '310.00',
    type: 'EXPENSE',
    categoryName: 'Lazer & Assinaturas',
    paymentMethod: 'PIX',
    transactionDate: '2026-08-25',
    sourceChannel: 'WHATSAPP_AUDIO',
  },

  // ==========================================
  // HISTÓRICO ANTERIOR (Julho, Junho e Maio 2026)
  // Alimenta os gráficos de tendência e fluxo semestral
  // ==========================================
  {
    description: 'Salário CLT Mensal — Tech Corp',
    amount: '6800.00',
    type: 'INCOME',
    categoryName: 'Salário & Renda',
    paymentMethod: 'PIX',
    transactionDate: '2026-07-05',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Despesas Consolidadas de Moradia e Mercado',
    amount: '3200.00',
    type: 'EXPENSE',
    categoryName: 'Moradia & Contas',
    paymentMethod: 'PIX',
    transactionDate: '2026-07-10',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Salário CLT Mensal — Tech Corp',
    amount: '6800.00',
    type: 'INCOME',
    categoryName: 'Salário & Renda',
    paymentMethod: 'PIX',
    transactionDate: '2026-06-05',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Despesas Consolidadas de Moradia e Mercado',
    amount: '3100.00',
    type: 'EXPENSE',
    categoryName: 'Moradia & Contas',
    paymentMethod: 'PIX',
    transactionDate: '2026-06-10',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Salário CLT Mensal — Tech Corp',
    amount: '6800.00',
    type: 'INCOME',
    categoryName: 'Salário & Renda',
    paymentMethod: 'PIX',
    transactionDate: '2026-05-05',
    sourceChannel: 'WEB_DASHBOARD',
  },
  {
    description: 'Despesas Consolidadas de Moradia e Mercado',
    amount: '3350.00',
    type: 'EXPENSE',
    categoryName: 'Moradia & Contas',
    paymentMethod: 'PIX',
    transactionDate: '2026-05-10',
    sourceChannel: 'WEB_DASHBOARD',
  },
];

const SEED_INSIGHTS: Array<{
  type: InsightType;
  title: string;
  content: string;
  dataPayload: Record<string, unknown>;
}> = [
  {
    type: 'EXPENSE_REDUCTION',
    title: 'Oportunidade: Redução em Refeições Rápidas & Delivery',
    content:
      'Identificamos que você gastou em pequenos lanches e delivery nas últimas semanas. Preparar 2 refeições a mais por semana geraria uma economia estimada de R$ 210,00/mês para a sua reserva.',
    dataPayload: { potentialSavings: 210, category: 'Alimentação & Mercado' },
  },
  {
    type: 'ANOMALY_DETECTED',
    title: 'Anomalia Detectada: Manutenção de Transporte',
    content:
      'Seus gastos com manutenção veicular e combustíveis tiveram uma oscilação atípica de +38% em relação à média trimestral devido ao reparo das pastilhas de freio.',
    dataPayload: { variancePercent: 38.5, metric: 'Transporte & Combustível' },
  },
  {
    type: 'CORRELATION',
    title: 'Padrão Temporal: 62% das despesas de lazer ocorrem no fim de semana',
    content:
      'Suas transações com cinema, restaurantes e passeios concentram-se fortemente entre sexta-feira à noite e domingo. Estabelecer um teto de R$ 150 por fim de semana manterá suas metas financeiras dentro do previsto.',
    dataPayload: { weekendConcentration: 0.62 },
  },
];

export async function runSeed(): Promise<void> {
  console.log('🌱 [WKontrolAI] Iniciando seed de dados para demonstração...');

  try {
    // 1. Criar ou atualizar Usuário de Demonstração
    let [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.whatsappPhone, DEMO_USER_PHONE))
      .limit(1);

    if (!user) {
      // Checa por email também
      const [userByEmail] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, DEMO_USER_EMAIL))
        .limit(1);

      if (userByEmail) {
        user = userByEmail;
      }
    }

    if (!user) {
      const [newUser] = await db
        .insert(schema.users)
        .values({
          name: DEMO_USER_NAME,
          email: DEMO_USER_EMAIL,
          whatsappPhone: DEMO_USER_PHONE,
          whatsappVerifiedAt: new Date('2026-05-01T10:00:00Z'),
          status: 'ACTIVE',
        })
        .returning();
      user = newUser;
      console.log(`👤 Usuário demo criado: ${user.name} (${user.whatsappPhone}) [ID: ${user.id}]`);
    } else {
      const [updatedUser] = await db
        .update(schema.users)
        .set({
          name: DEMO_USER_NAME,
          whatsappPhone: DEMO_USER_PHONE,
          whatsappVerifiedAt: new Date('2026-05-01T10:00:00Z'),
          status: 'ACTIVE',
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, user.id))
        .returning();
      user = updatedUser;
      console.log(`👤 Usuário demo atualizado: ${user.name} (${user.whatsappPhone}) [ID: ${user.id}]`);
    }

    // 2. Criar ou localizar Tenant do Usuário
    let [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id))
      .limit(1);

    if (!tenant) {
      const [newTenant] = await db
        .insert(schema.tenants)
        .values({
          ownerId: user.id,
          name: 'Finanças Pessoais',
          plan: 'PRO',
        })
        .returning();
      tenant = newTenant;
      console.log(`🏢 Tenant demo criado: ${tenant.name} [ID: ${tenant.id}]`);
    } else {
      console.log(`🏢 Tenant demo localizado: ${tenant.name} [ID: ${tenant.id}]`);
    }

    // 3. Garantir Categorias Padrão
    const existingCategories = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.tenantId, tenant.id));

    const categoryMap = new Map<string, string>(); // name -> categoryId

    for (const cat of existingCategories) {
      categoryMap.set(cat.name, cat.id);
    }

    const categoriesToInsert = DEFAULT_TENANT_CATEGORIES.filter(
      (defaultCat) => !categoryMap.has(defaultCat.name)
    );

    if (categoriesToInsert.length > 0) {
      const inserted = await db
        .insert(schema.categories)
        .values(
          categoriesToInsert.map((c) => ({
            tenantId: tenant.id,
            name: c.name,
            type: c.type,
            icon: c.icon,
            color: c.color,
            isDefault: c.isDefault,
          }))
        )
        .returning();

      for (const cat of inserted) {
        categoryMap.set(cat.name, cat.id);
      }
      console.log(`📁 Inseridas ${inserted.length} novas categorias padrão.`);
    } else {
      console.log(`📁 ${existingCategories.length} categorias já configuradas.`);
    }

    // 4. Limpeza e inserção idempotente de Transações
    await db
      .delete(schema.transactions)
      .where(eq(schema.transactions.tenantId, tenant.id));

    const defaultFallbackCategoryId = Array.from(categoryMap.values())[0];

    const transactionsPayload = SEED_TRANSACTIONS.map((tx) => {
      const categoryId = categoryMap.get(tx.categoryName) || defaultFallbackCategoryId;
      return {
        tenantId: tenant.id,
        userId: user.id,
        categoryId,
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        paymentMethod: tx.paymentMethod,
        transactionDate: tx.transactionDate,
        sourceChannel: tx.sourceChannel,
        confirmedByUser: true,
        metadata: {
          seededAt: new Date().toISOString(),
          demo: true,
        },
      };
    });

    const insertedTransactions = await db
      .insert(schema.transactions)
      .values(transactionsPayload)
      .returning();

    console.log(`💳 Inseridas com sucesso ${insertedTransactions.length} transações realistas de receitas e despesas.`);

    // 5. Inserir Insights Preditivos da IA para o tenant
    const existingInsights = await db
      .select()
      .from(schema.aiInsights)
      .where(eq(schema.aiInsights.tenantId, tenant.id));

    if (existingInsights.length === 0) {
      await db.insert(schema.aiInsights).values(
        SEED_INSIGHTS.map((insight) => ({
          tenantId: tenant.id,
          type: insight.type,
          title: insight.title,
          content: insight.content,
          dataPayload: insight.dataPayload,
          userFeedback: 'UNRATED' as const,
        }))
      );
      console.log(`🧠 Inseridos ${SEED_INSIGHTS.length} insights preditivos da IA.`);
    }

    console.log('✅ [WKontrolAI] Banco de dados populado com sucesso para demonstração local!');
  } catch (error) {
    console.error('❌ [WKontrolAI] Erro durante a execução do seed:', error);
    process.exitCode = 1;
  } finally {
    // Encerra a conexão com o pool do PostgreSQL para liberar o processo Node.js
    await client.end({ timeout: 5 });
  }
}

// Execução direta do script via CLI (tsx)
if (require.main === module || process.argv[1]?.endsWith('seed.ts')) {
  runSeed().catch((err) => {
    console.error('Fatal Seed Error:', err);
    process.exit(1);
  });
}
