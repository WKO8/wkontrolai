/**
 * WKontrolAI — Endpoint de Consulta de Categorias do Tenant (/api/categories)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { normalizeBrazilianPhoneToE164 } from '@/lib/utils/phone';
import { DEFAULT_TENANT_CATEGORIES } from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const tenantIdParam = searchParams.get('tenantId');

    let tenantId = tenantIdParam;

    if (!tenantId && phone) {
      try {
        const normalized = normalizeBrazilianPhoneToE164(phone);
        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.whatsappPhone, normalized))
          .limit(1);

        if (user) {
          const [tenant] = await db
            .select()
            .from(schema.tenants)
            .where(eq(schema.tenants.ownerId, user.id))
            .limit(1);
          if (tenant) tenantId = tenant.id;
        }
      } catch {
        // Formato de telefone inválido
      }
    }

    if (!tenantId) {
      const [firstTenant] = await db
        .select()
        .from(schema.tenants)
        .limit(1);
      if (firstTenant) tenantId = firstTenant.id;
    }

    if (tenantId) {
      const categories = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.tenantId, tenantId));

      if (categories.length > 0) {
        return NextResponse.json({ success: true, categories });
      }
    }

    // Retorna categorias padrão se nenhum tenant foi encontrado
    const fallbackCategories = DEFAULT_TENANT_CATEGORIES.map((cat, index) => ({
      id: `00000000-0000-0000-0000-00000000000${index + 1}`,
      name: cat.name,
      type: cat.type,
      icon: cat.icon,
      color: cat.color,
      isDefault: cat.isDefault,
    }));

    return NextResponse.json({ success: true, categories: fallbackCategories });
  } catch (error) {
    console.error('[/api/categories GET Error]:', error);
    return NextResponse.json(
      { error: 'Erro ao listar categorias' },
      { status: 500 }
    );
  }
}
