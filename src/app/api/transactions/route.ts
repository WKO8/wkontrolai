/**
 * WKontrolAI — Gateway Relacional de Transações & Extrato (/api/transactions)
 * US-07 — Consulta, Agregação Financeira, Filtros e Inserção Manual via Dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, lte, desc, asc, ilike, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import {
  transactionFilterQuerySchema,
  createTransactionSchema,
  updateTransactionSchema,
  transactionsListResponseSchema,
  transactionItemResponseSchema,
} from '@/lib/validations/transaction';
import { normalizeBrazilianPhoneToE164 } from '@/lib/utils/phone';

export const dynamic = 'force-dynamic';

/**
 * GET /api/transactions
 * Consulta lista de transações com filtros (período, datas, tipo, categoria, busca),
 * realiza JOIN com categorias e calcula o resumo financeiro consolidado.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const queryObj: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      queryObj[key] = val;
    });

    const parseResult = transactionFilterQuerySchema.safeParse(queryObj);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Parâmetros de filtro inválidos',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const filters = parseResult.data;

    // 1. Resolução do Tenant ID (por tenantId explícito, phone ou primeiro tenant ativo)
    let tenantId = filters.tenantId;

    if (!tenantId && filters.phone) {
      try {
        const normalizedPhone = normalizeBrazilianPhoneToE164(filters.phone);
        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.whatsappPhone, normalizedPhone))
          .limit(1);

        if (user) {
          const [tenant] = await db
            .select()
            .from(schema.tenants)
            .where(eq(schema.tenants.ownerId, user.id))
            .limit(1);

          if (tenant) {
            tenantId = tenant.id;
          }
        }
      } catch {
        // Telefone com formato inválido ignorado
      }
    }

    // Se nenhum tenant foi informado por parâmetro ou telefone, busca o primeiro tenant ativo (modo demo / local dev)
    if (!tenantId) {
      const [firstTenant] = await db
        .select()
        .from(schema.tenants)
        .limit(1);

      if (firstTenant) {
        tenantId = firstTenant.id;
      }
    }

    // Se nenhum tenant foi localizado ou informado, retorna extrato vazio com segurança
    if (!tenantId) {
      const emptyPayload = {
        success: true as const,
        transactions: [],
        summary: {
          currentBalance: 0,
          totalIncome: 0,
          totalExpense: 0,
          transactionCount: 0,
        },
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: 0,
          totalPages: 0,
        },
      };
      return NextResponse.json(transactionsListResponseSchema.parse(emptyPayload), {
        status: 200,
      });
    }

    // 2. Construção dinâmica das cláusulas de filtro
    const conditions: SQL[] = [eq(schema.transactions.tenantId, tenantId)];

    let startDate = filters.startDate;
    let endDate = filters.endDate;

    // Se filters.period === 'last-90-days', calcula automaticamente startDate (hoje - 90 dias) e endDate (hoje) caso startDate não tenha sido passado explicitamente
    if (filters.period === 'last-90-days' && !startDate) {
      const today = new Date();
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(today.getDate() - 90);
      startDate = ninetyDaysAgo.toISOString().split('T')[0];
      if (!endDate) {
        endDate = today.toISOString().split('T')[0];
      }
    }

    // Filtro por período específico no formato YYYY-MM (ignora 'last-90-days' e 'all')
    if (filters.period && filters.period !== 'last-90-days' && filters.period !== 'all') {
      conditions.push(gte(schema.transactions.transactionDate, `${filters.period}-01`));
      conditions.push(lte(schema.transactions.transactionDate, `${filters.period}-31`));
    }

    // Filtro por intervalo de datas customizado ou derivado
    if (startDate) {
      conditions.push(gte(schema.transactions.transactionDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.transactions.transactionDate, endDate));
    }

    // Filtro por tipo de transação (EXPENSE ou INCOME)
    if (filters.type) {
      conditions.push(eq(schema.transactions.type, filters.type));
    }

    // Filtro por categoria específica
    if (filters.categoryId) {
      conditions.push(eq(schema.transactions.categoryId, filters.categoryId));
    }

    // Filtro por método de pagamento
    if (filters.paymentMethod) {
      conditions.push(eq(schema.transactions.paymentMethod, filters.paymentMethod));
    }

    // Busca textual por descrição
    if (filters.search && filters.search.trim().length > 0) {
      conditions.push(ilike(schema.transactions.description, `%${filters.search.trim()}%`));
    }

    // 3. Execução da query com LEFT JOIN nas categorias
    const orderColumn =
      filters.sortBy === 'amount'
        ? schema.transactions.amount
        : filters.sortBy === 'createdAt'
          ? schema.transactions.createdAt
          : schema.transactions.transactionDate;

    const orderFn = filters.sortOrder === 'asc' ? asc : desc;

    const allRows = await db
      .select({
        transaction: schema.transactions,
        category: schema.categories,
      })
      .from(schema.transactions)
      .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
      .where(and(...conditions))
      .orderBy(orderFn(orderColumn), desc(schema.transactions.createdAt));

    // 4. Cálculo agregado do resumo financeiro sobre o universo filtrado
    let totalIncome = 0;
    let totalExpense = 0;

    for (const row of allRows) {
      const amountVal = Number(row.transaction.amount);
      if (row.transaction.type === 'INCOME') {
        totalIncome += amountVal;
      } else {
        totalExpense += amountVal;
      }
    }

    const currentBalance = Number((totalIncome - totalExpense).toFixed(2));
    totalIncome = Number(totalIncome.toFixed(2));
    totalExpense = Number(totalExpense.toFixed(2));
    const total = allRows.length;

    // 5. Paginação em memória
    const page = filters.page;
    const limit = filters.limit;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedRows = allRows.slice(startIndex, startIndex + limit);

    // 6. Mapeamento para o formato do schema de resposta
    const mappedTransactions = paginatedRows.map(({ transaction: t, category: c }) => ({
      id: t.id,
      tenantId: t.tenantId,
      userId: t.userId,
      categoryId: t.categoryId,
      categoryName: c?.name ?? 'Outros',
      categoryIcon: c?.icon ?? null,
      categoryColor: c?.color ?? '#6b7280',
      type: t.type,
      amount: Number(t.amount).toFixed(2),
      description: t.description,
      paymentMethod: t.paymentMethod,
      transactionDate: t.transactionDate,
      sourceChannel: t.sourceChannel,
      confirmedByUser: t.confirmedByUser,
      rawPayload: t.rawPayload,
      metadata: (t.metadata as Record<string, unknown>) ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    const responsePayload = {
      success: true as const,
      transactions: mappedTransactions,
      summary: {
        currentBalance,
        totalIncome,
        totalExpense,
        transactionCount: total,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };

    return NextResponse.json(transactionsListResponseSchema.parse(responsePayload), {
      status: 200,
    });
  } catch (error) {
    console.error('[/api/transactions GET Error]:', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao consultar transações',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transactions
 * Cria um novo lançamento financeiro manual via Dashboard PWA.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await req.json();

    const parseResult = createTransactionSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Dados de transação inválidos',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // 1. Resolução segura do Tenant e Usuário através da categoria informada
    const [category] = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, input.categoryId))
      .limit(1);

    if (!category) {
      return NextResponse.json(
        { error: 'Categoria informada não foi encontrada' },
        { status: 400 }
      );
    }

    const tenantId = input.tenantId || category.tenantId;

    // Se o caller informou um tenantId diferente da categoria, rejeita por inconsistência de autorização
    if (input.tenantId && input.tenantId !== category.tenantId) {
      return NextResponse.json(
        { error: 'A categoria informada não pertence ao tenant especificado' },
        { status: 403 }
      );
    }

    let userId = input.userId;
    if (!userId) {
      const [tenant] = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);
      userId = tenant?.ownerId;
    }

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'Não foi possível identificar o tenant ou usuário responsável' },
        { status: 400 }
      );
    }

    // 3. Inserção da transação na tabela transactions
    const [newTransaction] = await db
      .insert(schema.transactions)
      .values({
        tenantId,
        userId,
        categoryId: category.id,
        type: input.type,
        amount: input.amount.toFixed(2),
        description: input.description,
        paymentMethod: input.paymentMethod || 'OTHER',
        transactionDate: input.transactionDate,
        sourceChannel: input.sourceChannel || 'WEB_DASHBOARD',
        confirmedByUser: true,
        rawPayload: null,
        metadata: (input.metadata as Record<string, unknown>) ?? null,
      })
      .returning();

    // 4. Registro no log de auditoria
    await db.insert(schema.auditLogs).values({
      tenantId,
      userId,
      action: 'TRANSACTION_CREATED',
      entityType: 'TRANSACTION',
      entityId: newTransaction.id,
      metadata: {
        amount: input.amount,
        description: input.description,
        type: input.type,
        channel: 'WEB_DASHBOARD',
      },
    });

    // 5. Retorno com dados enriquecidos da categoria
    const responseData = {
      id: newTransaction.id,
      tenantId: newTransaction.tenantId,
      userId: newTransaction.userId,
      categoryId: newTransaction.categoryId,
      categoryName: category.name,
      categoryIcon: category.icon,
      categoryColor: category.color,
      type: newTransaction.type,
      amount: Number(newTransaction.amount).toFixed(2),
      description: newTransaction.description,
      paymentMethod: newTransaction.paymentMethod,
      transactionDate: newTransaction.transactionDate,
      sourceChannel: newTransaction.sourceChannel,
      confirmedByUser: newTransaction.confirmedByUser,
      rawPayload: newTransaction.rawPayload,
      metadata: (newTransaction.metadata as Record<string, unknown>) ?? null,
      createdAt: newTransaction.createdAt.toISOString(),
      updatedAt: newTransaction.updatedAt.toISOString(),
    };

    return NextResponse.json(transactionItemResponseSchema.parse(responseData), {
      status: 201,
    });
  } catch (error) {
    console.error('[/api/transactions POST Error]:', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao criar transação',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/transactions
 * Atualiza campos de uma transação existente com isolamento estrito de tenantId.
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await req.json();
    const parseResult = updateTransactionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos para atualização',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // 1. Resolução segura e mandatória de Tenant (por tenantId explícito ou phone pareado)
    let resolvedTenantId = input.tenantId;

    if (!resolvedTenantId && input.phone) {
      try {
        const normalizedPhone = normalizeBrazilianPhoneToE164(input.phone);
        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.whatsappPhone, normalizedPhone))
          .limit(1);

        if (user) {
          const [tenant] = await db
            .select()
            .from(schema.tenants)
            .where(eq(schema.tenants.ownerId, user.id))
            .limit(1);

          if (tenant) {
            resolvedTenantId = tenant.id;
          }
        }
      } catch {
        // Telefone inválido
      }
    }

    if (!resolvedTenantId) {
      return NextResponse.json(
        { error: 'Tenant ou telefone pareado é obrigatório para autorização de alteração' },
        { status: 401 }
      );
    }

    // 2. Localiza a transação existente garantindo escopo de tenantId (anti-IDOR)
    const [existing] = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.id, input.id),
          eq(schema.transactions.tenantId, resolvedTenantId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Transação não encontrada ou não pertencente ao seu workspace' },
        { status: 404 }
      );
    }

    const tenantId = resolvedTenantId;

    // Se informou categoryId, garante que a categoria pertença ao tenant
    if (input.categoryId) {
      const [cat] = await db
        .select()
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.id, input.categoryId),
            eq(schema.categories.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!cat) {
        return NextResponse.json(
          { error: 'Categoria informada não encontrada no workspace' },
          { status: 400 }
        );
      }
    }

    const updateFields: Partial<typeof schema.transactions.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.amount !== undefined) updateFields.amount = input.amount.toFixed(2);
    if (input.description !== undefined) updateFields.description = input.description;
    if (input.type !== undefined) updateFields.type = input.type;
    if (input.categoryId !== undefined) updateFields.categoryId = input.categoryId;
    if (input.paymentMethod !== undefined) updateFields.paymentMethod = input.paymentMethod;
    if (input.transactionDate !== undefined) updateFields.transactionDate = input.transactionDate;
    if (input.metadata !== undefined) updateFields.metadata = (input.metadata as Record<string, unknown>) ?? null;

    // Garante isolamento estrito de tenantId no UPDATE
    const [updated] = await db
      .update(schema.transactions)
      .set(updateFields)
      .where(
        and(
          eq(schema.transactions.id, input.id),
          eq(schema.transactions.tenantId, tenantId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Falha ao atualizar transação no banco de dados' },
        { status: 404 }
      );
    }

    // Busca categoria atualizada para retorno enriquecido
    const [category] = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, updated.categoryId))
      .limit(1);

    // Registro no log de auditoria (US-07)
    await db.insert(schema.auditLogs).values({
      tenantId: updated.tenantId,
      userId: updated.userId,
      action: 'TRANSACTION_EDITED',
      entityType: 'TRANSACTION',
      entityId: updated.id,
      metadata: {
        previousAmount: existing.amount,
        newAmount: updated.amount,
        description: updated.description,
      },
    });

    const responseData = {
      id: updated.id,
      tenantId: updated.tenantId,
      userId: updated.userId,
      categoryId: updated.categoryId,
      categoryName: category?.name ?? 'Outros',
      categoryIcon: category?.icon ?? null,
      categoryColor: category?.color ?? '#6b7280',
      type: updated.type,
      amount: Number(updated.amount).toFixed(2),
      description: updated.description,
      paymentMethod: updated.paymentMethod,
      transactionDate: updated.transactionDate,
      sourceChannel: updated.sourceChannel,
      confirmedByUser: updated.confirmedByUser,
      rawPayload: updated.rawPayload,
      metadata: (updated.metadata as Record<string, unknown>) ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };

    return NextResponse.json(transactionItemResponseSchema.parse(responseData), {
      status: 200,
    });
  } catch (error) {
    console.error('[/api/transactions PATCH Error]:', error);
    return NextResponse.json(
      { error: 'Erro interno ao atualizar transação' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/transactions
 * Exclui uma transação com isolamento estrito de tenant e log de auditoria.
 * Retorna { success: true, deletedId: id }.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');
    let tenantId = searchParams.get('tenantId') || undefined;
    let phone = searchParams.get('phone') || undefined;

    if (!id) {
      try {
        const body = (await req.json()) as { id?: string; tenantId?: string; phone?: string };
        if (body.id) id = body.id;
        if (body.tenantId) tenantId = body.tenantId;
        if (body.phone) phone = body.phone;
      } catch {
        // Sem body JSON
      }
    }

    if (!id) {
      return NextResponse.json(
        { error: 'ID da transação é obrigatório para exclusão' },
        { status: 400 }
      );
    }

    // Se phone foi passado e tenantId não, resolve tenantId pelo telefone
    if (!tenantId && phone) {
      try {
        const normalized = normalizeBrazilianPhoneToE164(phone);
        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.whatsappPhone, normalized))
          .limit(1);

        if (user) {
          const [t] = await db
            .select()
            .from(schema.tenants)
            .where(eq(schema.tenants.ownerId, user.id))
            .limit(1);
          if (t) {
            tenantId = t.id;
          }
        }
      } catch {
        // Phone inválido ignorado
      }
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ou telefone pareado é obrigatório para autorização de exclusão' },
        { status: 401 }
      );
    }

    const [existing] = await db
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.id, id),
          eq(schema.transactions.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Transação não encontrada ou não pertencente ao seu workspace' },
        { status: 404 }
      );
    }

    const effectiveTenantId = tenantId;

    await db
      .delete(schema.transactions)
      .where(
        and(
          eq(schema.transactions.id, id),
          eq(schema.transactions.tenantId, effectiveTenantId)
        )
      );

    // Registro no log de auditoria (US-07)
    await db.insert(schema.auditLogs).values({
      tenantId: effectiveTenantId,
      userId: existing.userId,
      action: 'TRANSACTION_DELETED',
      entityType: 'TRANSACTION',
      entityId: existing.id,
      metadata: {
        deletedAmount: existing.amount,
        description: existing.description,
        type: existing.type,
      },
    });

    return NextResponse.json(
      { success: true, deletedId: id },
      { status: 200 }
    );
  } catch (error) {
    console.error('[/api/transactions DELETE Error]:', error);
    return NextResponse.json(
      { error: 'Erro interno ao excluir transação' },
      { status: 500 }
    );
  }
}

