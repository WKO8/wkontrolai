/**
 * WKontrolAI — Endpoint Canônico de Pareamento & Autenticação de WhatsApp (/api/auth/pair)
 * US-01 — Vinculação, Geração de OTP no Redis e Cadastro Rápido Idempotente
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { redis } from '@/lib/queue/redis';
import {
  pairRequestSchema,
  pairStatusQuerySchema,
  pairResponseSchema,
  pairStatusResponseSchema,
  DEFAULT_TENANT_CATEGORIES,
} from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/pair
 * Recebe telefone sanitizado E.164, cadastra/localiza usuário e tenant, e gera código OTP no Redis.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await req.json();

    const parseResult = pairRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos para pareamento',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { phone: normalizedPhone, name, email } = parseResult.data;
    const digitsOnly = normalizedPhone.replace(/\D/g, '');

    // Rate limit defensivo para geração de OTP por telefone (máximo 5 pedidos em 10 minutos)
    const rateLimitKey = `ratelimit:pair:${normalizedPhone}`;
    const attempts = await redis.incr(rateLimitKey);
    if (attempts === 1) {
      await redis.expire(rateLimitKey, 600);
    }
    if (attempts > 5) {
      return NextResponse.json(
        {
          error: 'Muitas tentativas de vinculação. Por favor, aguarde alguns minutos.',
        },
        { status: 429 }
      );
    }

    // 1. Localiza ou cria o usuário pelo telefone E.164
    let [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.whatsappPhone, normalizedPhone))
      .limit(1);

    if (!user) {
      const userEmail = email || `${digitsOnly}@wkontrol.local`;
      const userName = name || `Usuário ${digitsOnly.slice(-4)}`;

      const [newUser] = await db
        .insert(schema.users)
        .values({
          name: userName,
          email: userEmail,
          whatsappPhone: normalizedPhone,
          whatsappVerifiedAt: null, // Pendente até confirmação do OTP via WhatsApp
          status: 'ACTIVE',
        })
        .returning();
      user = newUser;
    } else {
      // Atualiza nome caso tenha sido enviado
      if (name && name !== user.name) {
        const [updatedUser] = await db
          .update(schema.users)
          .set({
            name,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, user.id))
          .returning();
        user = updatedUser;
      }
    }

    // 2. Localiza ou cria o tenant padrão para o usuário
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
          plan: 'BETA',
        })
        .returning();
      tenant = newTenant;

      // Seeding das 8 categorias padrão no tenant recém-criado
      await db.insert(schema.categories).values(
        DEFAULT_TENANT_CATEGORIES.map((cat) => ({
          tenantId: tenant.id,
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          color: cat.color,
          isDefault: cat.isDefault,
        }))
      );
    }

    // 3. Geração do código OTP de 6 dígitos numéricos
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Armazena no Redis com TTL de 600 segundos (10 minutos)
    await redis.set(
      `otp:code:${otpCode}`,
      JSON.stringify({
        userId: user.id,
        tenantId: tenant.id,
        phone: normalizedPhone,
        createdAt: new Date().toISOString(),
      }),
      'EX',
      600
    );
    await redis.set(`otp:phone:${normalizedPhone}`, otpCode, 'EX', 600);

    // 5. Gera DeepLink oficial do WhatsApp
    const botPhone = (
      process.env.EVOLUTION_BOT_PHONE ||
      process.env.NEXT_PUBLIC_BOT_PHONE ||
      process.env.EVOLUTION_INSTANCE_NUMBER ||
      '5511999999999'
    ).replace(/\D/g, '');
    const deepLink = `https://wa.me/${botPhone}?text=VINCULAR%20${otpCode}`;

    // 6. Resposta formatada conforme contrato Zod
    const responsePayload = {
      success: true as const,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        whatsappPhone: user.whatsappPhone!,
        whatsappVerifiedAt: user.whatsappVerifiedAt
          ? user.whatsappVerifiedAt.toISOString()
          : null,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan: tenant.plan,
        ownerId: tenant.ownerId,
      },
      otpCode,
      deepLink,
      expiresInSeconds: 600,
      message: `Código ${otpCode} gerado com sucesso. Envie 'VINCULAR ${otpCode}' pelo WhatsApp.`,
    };

    return NextResponse.json(pairResponseSchema.parse(responsePayload), {
      status: 201,
    });
  } catch (error) {
    console.error('[/api/auth/pair POST Error]:', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao processar solicitação de pareamento',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/pair
 * Consulta se o telefone ou usuário informado já está pareado e ativo.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const queryParams = {
      phone: searchParams.get('phone') || undefined,
      userId: searchParams.get('userId') || undefined,
    };

    const parseResult = pairStatusQuerySchema.safeParse(queryParams);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Parâmetros de consulta inválidos',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { phone: normalizedPhone, userId } = parseResult.data;

    if (!normalizedPhone && !userId) {
      return NextResponse.json(
        { error: 'Informe ao menos o parâmetro phone ou userId' },
        { status: 400 }
      );
    }

    let user: typeof schema.users.$inferSelect | undefined;

    if (userId) {
      const [foundUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      user = foundUser;
    } else if (normalizedPhone) {
      const [foundUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.whatsappPhone, normalizedPhone))
        .limit(1);
      user = foundUser;
    }

    if (!user) {
      let hasPendingOtp = false;
      if (normalizedPhone) {
        hasPendingOtp = (await redis.exists(`otp:phone:${normalizedPhone}`)) === 1;
      }

      const emptyResponse = {
        isPaired: false,
        user: null,
        tenant: null,
        hasPendingOtp,
      };
      return NextResponse.json(pairStatusResponseSchema.parse(emptyResponse), {
        status: 200,
      });
    }

    // Busca o tenant do usuário
    const [tenant] = await db
      .select()
      .from(schema.tenants)
      .where(eq(schema.tenants.ownerId, user.id))
      .limit(1);

    const isPaired = user.status === 'ACTIVE' && user.whatsappVerifiedAt !== null;
    const hasPendingOtp = user.whatsappPhone
      ? (await redis.exists(`otp:phone:${user.whatsappPhone}`)) === 1
      : false;

    const responsePayload = {
      isPaired,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        whatsappPhone: user.whatsappPhone || '',
        whatsappVerifiedAt: user.whatsappVerifiedAt
          ? user.whatsappVerifiedAt.toISOString()
          : null,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            plan: tenant.plan,
            ownerId: tenant.ownerId,
          }
        : null,
      hasPendingOtp,
    };

    return NextResponse.json(pairStatusResponseSchema.parse(responsePayload), {
      status: 200,
    });
  } catch (error) {
    console.error('[/api/auth/pair GET Error]:', error);
    return NextResponse.json(
      {
        error: 'Erro interno ao consultar status de pareamento',
      },
      { status: 500 }
    );
  }
}
