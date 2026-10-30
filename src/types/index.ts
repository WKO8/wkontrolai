/**
 * WKontrolAI — Tipagens Canônicas e Contratos Globais de Domínio
 * Arquitetura Principal - Zero Any Policy
 */

// ==========================================
// 1. ENUMS E CONSTANTES DE DOMÍNIO
// ==========================================

export const TRANSACTION_TYPES = ['EXPENSE', 'INCOME'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PAYMENT_METHODS = [
  'PIX',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'CASH',
  'BANK_TRANSFER',
  'OTHER',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SOURCE_CHANNELS = [
  'WHATSAPP_AUDIO',
  'WHATSAPP_TEXT',
  'WHATSAPP_IMAGE',
  'WEB_DASHBOARD',
] as const;
export type SourceChannel = (typeof SOURCE_CHANNELS)[number];

export const TENANT_PLANS = ['FREE', 'PRO', 'BETA'] as const;
export type TenantPlan = (typeof TENANT_PLANS)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'DELETED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const INSIGHT_TYPES = [
  'EXPENSE_REDUCTION',
  'ANOMALY_DETECTED',
  'MONTHLY_SUMMARY',
  'CORRELATION',
] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];

export const INSIGHT_FEEDBACKS = ['HELPFUL', 'NOT_HELPFUL', 'UNRATED'] as const;
export type InsightFeedback = (typeof INSIGHT_FEEDBACKS)[number];

export const AUDIT_ACTIONS = [
  'AUTH_LOGIN',
  'AUTH_LOGOUT',
  'WHATSAPP_LINKED',
  'WHATSAPP_UNLINKED',
  'AI_TRANSCRIBED',
  'AI_PARSED',
  'AI_USER_CORRECTION',
  'TRANSACTION_CREATED',
  'TRANSACTION_EDITED',
  'TRANSACTION_DELETED',
  'LGPD_EXPORT_REQUESTED',
  'LGPD_ACCOUNT_DELETION',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const IDEMPOTENCY_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;
export type IdempotencyStatus = (typeof IDEMPOTENCY_STATUSES)[number];

// ==========================================
// 2. ENTIDADES DE BANCO DE DADOS (DATABASE MODELS)
// ==========================================

export interface UserEntity {
  id: string; // UUID v4
  email: string;
  name: string;
  avatarUrl: string | null;
  whatsappPhone: string | null; // E.164 (+55DD9XXXXXXXX)
  whatsappVerifiedAt: Date | null;
  status: UserStatus;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantEntity {
  id: string; // UUID v4
  ownerId: string; // References UserEntity.id
  name: string;
  plan: TenantPlan;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryEntity {
  id: string; // UUID v4
  tenantId: string; // References TenantEntity.id (RLS boundary)
  name: string;
  type: TransactionType;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionEntity {
  id: string; // UUID v4
  tenantId: string; // References TenantEntity.id (RLS boundary)
  userId: string; // References UserEntity.id
  categoryId: string; // References CategoryEntity.id
  type: TransactionType;
  amount: string; // Decimal format string '1234.56' for precise currency handling
  description: string;
  paymentMethod: PaymentMethod;
  transactionDate: string; // 'YYYY-MM-DD'
  sourceChannel: SourceChannel;
  confirmedByUser: boolean;
  rawPayload: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionWithCategory extends TransactionEntity {
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
}

export interface PendingConfirmationItem {
  amount: number;
  type: TransactionType;
  suggestedCategory: string;
  paymentMethod: PaymentMethod;
  description: string;
  transactionDate: string; // 'YYYY-MM-DD'
  confidenceScore?: number;
}

export interface PendingConfirmationEntity {
  id: string; // UUID v4
  whatsappPhone: string;
  tenantId: string;
  userId: string;
  sourceChannel: SourceChannel;
  extractedData: {
    hasFinancialIntent: boolean;
    missingInformation: string | null;
    transactions: PendingConfirmationItem[];
  };
  rawPayload: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface AiInsightEntity {
  id: string; // UUID v4
  tenantId: string;
  type: InsightType;
  title: string;
  content: string; // Markdown formatted
  dataPayload: Record<string, unknown> | null;
  userFeedback: InsightFeedback;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface AuditLogEntity {
  id: string; // UUID v4
  tenantId: string | null;
  userId: string | null;
  action: AuditAction | string;
  entityType: string; // e.g. 'TRANSACTION', 'USER', 'WHATSAPP'
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

// ==========================================
// 3. CONTEXTO DE EXECUÇÃO & SEGURANÇA (RLS & MULTI-TENANCY)
// ==========================================

export interface SecurityContext {
  userId: string;
  tenantId: string;
  userEmail: string;
  whatsappPhone?: string;
  isServiceRole?: boolean;
}

// ==========================================
// 4. PADRÃO RESULT / EITHER PARA TRATAMENTO FUNCIONAL DE ERROS
// ==========================================

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export interface AppError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

// ==========================================
// 5. CONTRATOS DE TELEMETRIA E IA
// ==========================================

export interface AudioTranscriptionResult {
  text: string;
  durationSeconds: number;
  latencyMs: number;
  language: string;
}

export interface AiExtractionMetadata {
  promptVersion: string;
  tokensPrompt: number;
  tokensCompletion: number;
  latencyMs: number;
  model: string;
}

// ==========================================
// 6. CONTRATOS DE DASHBOARD E PAREAMENTO (US-01 / US-07)
// ==========================================

export interface FinancialSummaryMetrics {
  currentBalance: number;
  totalIncome: number;
  totalExpense: number;
  transactionCount: number;
}

export interface PairingSessionData {
  userId: string;
  tenantId: string;
  phone: string;
  otpCode: string;
  createdAt: string;
}
