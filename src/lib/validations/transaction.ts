/**
 * WKontrolAI — Schemas de Validação de Transações e Inferência de IA (Zod)
 * Runtime validation para mutações, extrações de IA, extrato e consultas reais
 */

import { z } from 'zod';
import {
  TRANSACTION_TYPES,
  PAYMENT_METHODS,
  SOURCE_CHANNELS,
  INSIGHT_TYPES,
  INSIGHT_FEEDBACKS,
} from '@/types';

// ==========================================
// 1. SCHEMAS BÁSICOS / ENUMS REUTILIZÁVEIS
// ==========================================

export const transactionTypeSchema = z.enum(TRANSACTION_TYPES, {
  errorMap: () => ({ message: 'Tipo deve ser EXPENSE ou INCOME' }),
});

export const paymentMethodSchema = z.enum(PAYMENT_METHODS, {
  errorMap: () => ({ message: 'Método de pagamento inválido' }),
});

export const sourceChannelSchema = z.enum(SOURCE_CHANNELS, {
  errorMap: () => ({ message: 'Canal de origem inválido' }),
});

export const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
export const dateStringSchema = z
  .string()
  .regex(isoDateRegex, { message: 'Data deve estar no formato ISO YYYY-MM-DD' });

export const monetaryAmountSchema = z
  .number({ invalid_type_error: 'Valor deve ser numérico' })
  .positive({ message: 'Valor deve ser estritamente maior que zero' })
  .max(10_000_000, { message: 'Valor excede o limite máximo permitido' })
  .transform((val) => Number(val.toFixed(2)));

export const monetaryAmountInputSchema = z
  .union([
    z.number(),
    z.string().transform((val, ctx) => {
      const normalized = val.trim().replace(/\./g, '').replace(',', '.');
      const parsed = isNaN(Number(normalized)) ? parseFloat(val.replace(',', '.')) : Number(normalized);
      if (isNaN(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Valor monetário inválido',
        });
        return z.NEVER;
      }
      return parsed;
    }),
  ])
  .pipe(monetaryAmountSchema);

// ==========================================
// 2. CONTRATOS DE EXTRAÇÃO DA IA (DEEPSEEK / MULTIMODAL)
// ==========================================

export const extractedTransactionItemSchema = z.object({
  amount: monetaryAmountSchema.describe('Valor monetário em reais com 2 casas decimais'),
  type: transactionTypeSchema.describe('EXPENSE para saída/gasto, INCOME para entrada/receita'),
  suggested_category: z
    .string()
    .min(1, 'Categoria sugerida obrigatória')
    .max(60, 'Nome de categoria muito longo')
    .describe('Categoria mais provável (ex: Alimentação, Transporte, Moradia, Salário, etc)'),
  payment_method: paymentMethodSchema
    .default('OTHER')
    .describe('Forma de pagamento inferida na mensagem'),
  description: z
    .string()
    .min(1, 'Descrição não pode ser vazia')
    .max(120, 'Descrição não pode ultrapassar 120 caracteres')
    .describe('Resumo textual objetivo do lançamento'),
  transaction_date: dateStringSchema.describe(
    'Data da transação no formato YYYY-MM-DD baseada no fuso America/Sao_Paulo'
  ),
  confidence_score: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Grau de certeza da IA na extração (0.0 a 1.0)'),
});

export const llmExtractionResponseSchema = z.object({
  has_financial_intent: z
    .boolean()
    .describe('True se a mensagem contém informação ou intenção de gasto/receita financeira'),
  missing_information: z
    .string()
    .nullable()
    .describe(
      'Pergunta objetiva caso falte dado crítico (ex: valor não informado), ou null se tudo estiver completo'
    ),
  transactions: z
    .array(extractedTransactionItemSchema)
    .describe('Lista de uma ou mais transações identificadas no texto/áudio/comprovante'),
});

export type ExtractedTransactionItem = z.infer<typeof extractedTransactionItemSchema>;
export type LLMExtractionResponse = z.infer<typeof llmExtractionResponseSchema>;

// ==========================================
// 3. FLUXO DE CONFIRMAÇÃO & PATCHING DO WHATSAPP
// ==========================================

export const confirmationActionTypeSchema = z.enum([
  'CONFIRM', // Sim, positivo, emoji 👍
  'CANCEL',  // Não, cancela, emoji ❌
  'PATCH',   // Pedido de alteração de campo (ex: "Muda pra Pix", "Valor foi 50")
  'NEW_TRANSACTION', // Usuário mandou outro gasto em vez de responder à pendência
  'UNKNOWN', // Texto não compreendido no contexto
]);

export const userConfirmationPatchSchema = z.object({
  amount: monetaryAmountSchema.optional(),
  type: transactionTypeSchema.optional(),
  category: z.string().min(1).max(60).optional(),
  payment_method: paymentMethodSchema.optional(),
  description: z.string().min(1).max(120).optional(),
  transaction_date: dateStringSchema.optional(),
  removeItemIndex: z.number().int().optional(),
});

export const parsedConfirmationIntentSchema = z.object({
  action: confirmationActionTypeSchema,
  patch: userConfirmationPatchSchema.optional(),
  rawResponse: z.string(),
  reasoning: z.string().optional(),
});

export type ParsedConfirmationIntent = z.infer<typeof parsedConfirmationIntentSchema>;

// ==========================================
// 4. MUTAÇÕES E CRUD VIA DASHBOARD (/api/transactions)
// ==========================================

export const createTransactionSchema = z.object({
  amount: monetaryAmountInputSchema,
  type: transactionTypeSchema,
  categoryId: z.string().uuid({ message: 'categoryId deve ser um UUID válido' }),
  description: z
    .string()
    .trim()
    .min(2, 'Descrição deve conter no mínimo 2 caracteres')
    .max(255, 'Descrição não pode ultrapassar 255 caracteres'),
  paymentMethod: paymentMethodSchema.default('OTHER'),
  transactionDate: dateStringSchema.default(() => new Date().toISOString().split('T')[0]),
  sourceChannel: sourceChannelSchema.default('WEB_DASHBOARD'),
  tenantId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  phone: z.string().optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const updateTransactionSchema = createTransactionSchema.partial().and(
  z.object({
    id: z.string().uuid({ message: 'ID da transação deve ser um UUID válido' }),
  })
);

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

// ==========================================
// 5. CONSULTAS, FILTROS E PAGINAÇÃO (EXTRATO /api/transactions)
// ==========================================

export const transactionPeriodSchema = z.union([
  z.string().regex(/^\d{4}-\d{2}$/, 'Período deve estar no formato YYYY-MM'),
  z.literal('last-90-days'),
  z.literal('all'),
]);

export const transactionFilterQuerySchema = z.object({
  tenantId: z.string().uuid().optional(),
  phone: z.string().optional(),
  period: transactionPeriodSchema.optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  type: transactionTypeSchema.optional(),
  categoryId: z.string().uuid().optional(),
  paymentMethod: paymentMethodSchema.optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['transactionDate', 'amount', 'createdAt']).default('transactionDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type TransactionFilterQuery = z.infer<typeof transactionFilterQuerySchema>;

// ==========================================
// 6. RESPOSTAS ESTRUTURADAS DO ENDPOINT /api/transactions
// ==========================================

export const financialSummarySchema = z.object({
  currentBalance: z.number(),
  totalIncome: z.number(),
  totalExpense: z.number(),
  transactionCount: z.number(),
});

export type FinancialSummary = z.infer<typeof financialSummarySchema>;

export const transactionItemResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  categoryId: z.string().uuid(),
  categoryName: z.string().default('Outros'),
  categoryIcon: z.string().nullable().default(null),
  categoryColor: z.string().nullable().default('#6b7280'),
  type: transactionTypeSchema,
  amount: z.string(), // Formato decimal string '45.00'
  description: z.string(),
  paymentMethod: paymentMethodSchema,
  transactionDate: z.string(), // 'YYYY-MM-DD'
  sourceChannel: sourceChannelSchema,
  confirmedByUser: z.boolean(),
  rawPayload: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TransactionItemResponse = z.infer<typeof transactionItemResponseSchema>;

export const transactionsListResponseSchema = z.object({
  success: z.literal(true),
  transactions: z.array(transactionItemResponseSchema),
  summary: financialSummarySchema,
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

export type TransactionsListResponse = z.infer<typeof transactionsListResponseSchema>;

// ==========================================
// 7. CATEGORIAS (CRIAR E EDITAR)
// ==========================================

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome da categoria deve ter no mínimo 2 caracteres')
    .max(100, 'Nome não pode ter mais de 100 caracteres'),
  type: transactionTypeSchema,
  icon: z.string().max(50).optional().nullable(),
  color: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
      message: 'Cor deve ser um código hexadecimal válido (ex: #10B981)',
    })
    .optional()
    .nullable(),
});

export const updateCategorySchema = createCategorySchema.partial().and(
  z.object({
    id: z.string().uuid(),
  })
);

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ==========================================
// 8. IA INSIGHTS & FEEDBACK
// ==========================================

export const insightTypeSchema = z.enum(INSIGHT_TYPES);
export const insightFeedbackSchema = z.enum(INSIGHT_FEEDBACKS);

export const submitInsightFeedbackSchema = z.object({
  insightId: z.string().uuid({ message: 'insightId deve ser um UUID válido' }),
  feedback: insightFeedbackSchema,
});

export const generateInsightRequestSchema = z.object({
  periodDays: z.enum(['7', '30', '90']).default('30'),
  forceRefresh: z.boolean().default(false),
});

export type SubmitInsightFeedbackInput = z.infer<typeof submitInsightFeedbackSchema>;
export type GenerateInsightRequestInput = z.infer<typeof generateInsightRequestSchema>;
