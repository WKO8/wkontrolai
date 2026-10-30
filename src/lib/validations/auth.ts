/**
 * WKontrolAI — Schemas de Validação de Autenticação e Pareamento de WhatsApp (US-01)
 * Runtime validation para cadastro rápido e vinculação de dispositivo
 */

import { z } from 'zod';
import { normalizeBrazilianPhoneToE164 } from '@/lib/utils/phone';

// ==========================================
// 1. SCHEMAS DE ENTRADA (REQUESTS)
// ==========================================

export const phoneInputSchema = z
  .string({ required_error: 'Telefone é obrigatório' })
  .min(8, 'Telefone deve conter no mínimo 8 caracteres')
  .max(30, 'Telefone muito longo')
  .transform((val, ctx) => {
    try {
      return normalizeBrazilianPhoneToE164(val);
    } catch (err: unknown) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          err instanceof Error
            ? err.message
            : 'Número de telefone inválido para o padrão brasileiro (+55DD9XXXXXXXX)',
      });
      return z.NEVER;
    }
  });

export const pairRequestSchema = z.object({
  phone: phoneInputSchema,
  name: z
    .string()
    .trim()
    .min(2, 'Nome deve conter pelo menos 2 caracteres')
    .max(100, 'Nome deve conter no máximo 100 caracteres')
    .optional(),
  email: z
    .string()
    .trim()
    .email('E-mail informado é inválido')
    .optional(),
});

export type PairRequestInput = z.infer<typeof pairRequestSchema>;

/**
 * Expressão regular flexível e canônica para pareamento OTP do WhatsApp.
 * Suporta formatos:
 * - "VINCULAR 123456"
 * - "VINCULAR [123456]"
 * - "vincular: 123456"
 * - "vincular:[123456]"
 * - "[123456]"
 * - "123456"
 * E impede falsos positivos em mensagens cotidianas (ex: "Gastei 123456 no almoço").
 */
export const OTP_REGEX =
  /(?:(?:^|\b)vincular[:\s]*\[?(\d{3}[\s-]?\d{3})\]?(?:\b|$)|^\s*\[?(\d{3}[\s-]?\d{3})\]?\s*$)/i;

/**
 * Extrai o código OTP numérico de 6 dígitos de uma mensagem de texto com máxima flexibilidade.
 * Suporta:
 * - "VINCULAR 123456"
 * - "VINCULAR [123456]"
 * - "[123456]"
 * - "123456"
 * - "*VINCULAR 123456*" / "*123456*" (formatação do WhatsApp)
 * - "vincular: 123456"
 * - "VINCULAR 123 456" ou "123 456"
 * Retorna string com 6 dígitos normalizados ou null caso a mensagem não seja de pareamento.
 */
export function extractOtpCode(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  // Remove formatação comum de texto do WhatsApp (*negrito*, _itálico_, ~tachado~, `código`)
  const cleaned = text.replace(/[*_~`]/g, '').trim();
  const match = cleaned.match(OTP_REGEX);
  if (!match) return null;
  const rawDigits = match[1] || match[2];
  return rawDigits ? rawDigits.replace(/\D/g, '') : null;
}

export const pairStatusQuerySchema = z.object({
  phone: z
    .string()
    .optional()
    .transform((val, ctx) => {
      if (!val) return undefined;
      try {
        return normalizeBrazilianPhoneToE164(val);
      } catch (err: unknown) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            err instanceof Error
              ? err.message
              : 'Número de telefone inválido para consulta',
        });
        return z.NEVER;
      }
    }),
  userId: z.string().uuid('userId deve ser um UUID válido').optional(),
});

export type PairStatusQueryInput = z.infer<typeof pairStatusQuerySchema>;

// ==========================================
// 2. SCHEMAS DE SAÍDA (RESPONSES)
// ==========================================

export const pairedUserSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  whatsappPhone: z.string(),
  whatsappVerifiedAt: z.string().datetime().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']),
  createdAt: z.string().datetime(),
});

export const pairedTenantSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  plan: z.enum(['FREE', 'PRO', 'BETA']),
  ownerId: z.string().uuid(),
});

export const pairResponseSchema = z.object({
  success: z.literal(true),
  user: pairedUserSummarySchema,
  tenant: pairedTenantSummarySchema,
  otpCode: z.string().length(6),
  deepLink: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
  message: z.string(),
});

export type PairResponseData = z.infer<typeof pairResponseSchema>;

export const pairStatusResponseSchema = z.object({
  isPaired: z.boolean(),
  user: pairedUserSummarySchema.nullable(),
  tenant: pairedTenantSummarySchema.nullable(),
  hasPendingOtp: z.boolean().optional(),
});

export type PairStatusResponseData = z.infer<typeof pairStatusResponseSchema>;

// ==========================================
// 3. CATEGORIAS PADRÃO DE SEEDING DO TENANT
// ==========================================

export interface DefaultCategoryDefinition {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  icon: string;
  color: string;
  isDefault: boolean;
}

export const DEFAULT_TENANT_CATEGORIES: ReadonlyArray<DefaultCategoryDefinition> = [
  {
    name: 'Salário & Renda',
    type: 'INCOME',
    icon: 'briefcase',
    color: '#10b981',
    isDefault: true,
  },
  {
    name: 'Freelances / Extras',
    type: 'INCOME',
    icon: 'laptop',
    color: '#06b6d4',
    isDefault: false,
  },
  {
    name: 'Alimentação & Mercado',
    type: 'EXPENSE',
    icon: 'utensils',
    color: '#f97316',
    isDefault: true,
  },
  {
    name: 'Moradia & Contas',
    type: 'EXPENSE',
    icon: 'home',
    color: '#3b82f6',
    isDefault: false,
  },
  {
    name: 'Transporte & Combustível',
    type: 'EXPENSE',
    icon: 'car',
    color: '#eab308',
    isDefault: false,
  },
  {
    name: 'Saúde & Farmácia',
    type: 'EXPENSE',
    icon: 'heart-pulse',
    color: '#ef4444',
    isDefault: false,
  },
  {
    name: 'Lazer & Assinaturas',
    type: 'EXPENSE',
    icon: 'film',
    color: '#a855f7',
    isDefault: false,
  },
  {
    name: 'Outros',
    type: 'EXPENSE',
    icon: 'more-horizontal',
    color: '#6b7280',
    isDefault: false,
  },
] as const;
