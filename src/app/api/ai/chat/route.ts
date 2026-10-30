/**
 * WKontrolAI — Endpoint de Chat com IA Financeira RAG (/api/ai/chat)
 * US-08 — Assistente Interativo com Contexto Financeiro Real do Usuário (Últimos 90 dias)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, gte, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { deepseek } from '@/lib/ai/deepseek';
import { normalizeBrazilianPhoneToE164 } from '@/lib/utils/phone';
import { redis } from '@/lib/queue/redis';

export const dynamic = 'force-dynamic';

const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'A mensagem não pode ser vazia')
    .max(1000, 'Mensagem muito longa'),
  phone: z.string().optional(),
  tenantId: z.string().uuid().optional(),
  period: z.string().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = chatRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Parâmetros de chat inválidos',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { message, phone, tenantId: requestedTenantId } = parseResult.data;

    // 1. Identificação do Tenant do usuário
    let tenantId = requestedTenantId || null;
    let userName = 'usuário';

    if (!tenantId && phone) {
      try {
        const normalized = normalizeBrazilianPhoneToE164(phone);
        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.whatsappPhone, normalized))
          .limit(1);

        if (user) {
          userName = user.name.split(' ')[0] || 'você';
          const [tenant] = await db
            .select()
            .from(schema.tenants)
            .where(eq(schema.tenants.ownerId, user.id))
            .limit(1);
          if (tenant) tenantId = tenant.id;
        }
      } catch {
        // Ignora formatação de telefone
      }
    }

    if (!tenantId) {
      const noTenantReply =
        'Olá! Não localizamos uma conta ativa ou número de WhatsApp pareado para consultar suas finanças. Cadastre uma conta no WKontrolAI ou pareie seu número para conversar com a IA sobre seus lançamentos!';
      return NextResponse.json(
        {
          reply: noTenantReply,
          answer: noTenantReply,
        },
        { status: 200 }
      );
    }

    // 1.1 Rate limiting defensivo contra DoS e abuso de tokens LLM (máximo 30 mensagens por minuto por workspace)
    try {
      const rateLimitKey = `ratelimit:ai_chat:${tenantId}`;
      const chatAttempts = await redis.incr(rateLimitKey);
      if (chatAttempts === 1) {
        await redis.expire(rateLimitKey, 60);
      }
      if (chatAttempts > 30) {
        return NextResponse.json(
          {
            error: 'Limite de mensagens para o assistente atingido. Por favor, aguarde um minuto para continuar.',
            reply: 'Você enviou muitas mensagens em sequência. Por favor, aguarde um momento antes de fazer novas perguntas.',
          },
          { status: 429 }
        );
      }
    } catch (rlErr) {
      console.warn('[/api/ai/chat] Falha no rate limiter Redis:', rlErr);
    }

    // 2. RAG Retrieval: Busca histórico dos últimos 90 dias e resumo financeiro consolidado
    const today = new Date();
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(today.getDate() - 90);
    const startDate = ninetyDaysAgo.toISOString().split('T')[0];

    const rows = await db
      .select({
        tx: schema.transactions,
        cat: schema.categories,
      })
      .from(schema.transactions)
      .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
      .where(
        and(
          eq(schema.transactions.tenantId, tenantId),
          gte(schema.transactions.transactionDate, startDate)
        )
      )
      .orderBy(desc(schema.transactions.transactionDate), desc(schema.transactions.createdAt))
      .limit(60);

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryTotals: Record<string, number> = {};

    const formattedTransactions = rows.map((r) => {
      const amount = Number(r.tx.amount) || 0;
      const categoryName = r.cat?.name || 'Outros';

      if (r.tx.type === 'INCOME') {
        totalIncome += amount;
      } else {
        totalExpense += amount;
        categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + amount;
      }

      return {
        date: r.tx.transactionDate,
        type: r.tx.type,
        amount,
        description: r.tx.description,
        category: categoryName,
        paymentMethod: r.tx.paymentMethod,
      };
    });

    const currentBalance = Number((totalIncome - totalExpense).toFixed(2));
    totalIncome = Number(totalIncome.toFixed(2));
    totalExpense = Number(totalExpense.toFixed(2));

    // Ordena categorias com maiores despesas
    const sortedCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => {
        const pct = totalExpense > 0 ? ((val / totalExpense) * 100).toFixed(1) : '0';
        return `• ${cat}: R$ ${val.toFixed(2)} (${pct}% do total de gastos)`;
      });

    // 3. Monta o contexto textual para a IA
    const currencyFmt = (v: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const financialContext = `
Usuário: ${userName}
Período de Análise: Últimos 90 dias (${startDate} até hoje)
Total de Transações no Período: ${rows.length}
Saldo Atual do Período: ${currencyFmt(currentBalance)}
Total de Receitas: ${currencyFmt(totalIncome)}
Total de Despesas: ${currencyFmt(totalExpense)}

Principais Categorias de Despesas:
${sortedCategories.length > 0 ? sortedCategories.join('\n') : 'Nenhuma despesa registrada no período.'}

Amostra de Lançamentos Recentes (do mais recente ao mais antigo):
${formattedTransactions
  .slice(0, 30)
  .map(
    (t, idx) =>
      `${idx + 1}. [${t.date}] ${t.type === 'EXPENSE' ? 'Despesa' : 'Receita'} de ${currencyFmt(t.amount)} em "${t.description}" (Categoria: ${t.category}, Pagamento: ${t.paymentMethod})`
  )
  .join('\n')}
`.trim();

    // 4. Executa chamada ao DeepSeek V3 com system prompt restritivo
    let reply: string;
    try {
      reply = await deepseek.chatFinancialAssistant(message, financialContext);
    } catch (aiErr) {
      console.error('[/api/ai/chat] Falha na chamada da LLM DeepSeek:', aiErr);
      // Fallback determinístico caso a API externa esteja indisponível
      reply = `Olá, ${userName}! No momento estou com lentidão no processador de IA, mas consultei seus dados diretamente: seu saldo consolidado nos últimos 90 dias é de ${currencyFmt(currentBalance)} (Receitas: ${currencyFmt(totalIncome)} | Despesas: ${currencyFmt(totalExpense)} em ${rows.length} lançamentos). Por favor, repita sua pergunta em instantes.`;
    }

    return NextResponse.json({
      reply,
      answer: reply,
      metrics: {
        totalIncome,
        totalExpense,
        currentBalance,
        transactionCount: rows.length,
      },
    });
  } catch (error) {
    console.error('[/api/ai/chat POST Error]:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar chat financeiro' },
      { status: 500 }
    );
  }
}
