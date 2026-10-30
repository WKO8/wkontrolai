/**
 * WKontrolAI — Drizzle ORM Database Schema
 * PostgreSQL 16 com Suporte Estrito a Multi-Tenancy & Row-Level Security (RLS)
 */

import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  pgPolicy,
} from 'drizzle-orm/pg-core';
import {
  TRANSACTION_TYPES,
  PAYMENT_METHODS,
  SOURCE_CHANNELS,
  TENANT_PLANS,
  USER_STATUSES,
  INSIGHT_TYPES,
  INSIGHT_FEEDBACKS,
  IDEMPOTENCY_STATUSES,
} from '@/types';

// ==========================================
// 1. ENUMS POSTGRESQL
// ==========================================

export const transactionTypePgEnum = pgEnum('transaction_type', TRANSACTION_TYPES);
export const paymentMethodPgEnum = pgEnum('payment_method', PAYMENT_METHODS);
export const sourceChannelPgEnum = pgEnum('source_channel', SOURCE_CHANNELS);
export const tenantPlanPgEnum = pgEnum('tenant_plan', TENANT_PLANS);
export const userStatusPgEnum = pgEnum('user_status', USER_STATUSES);
export const insightTypePgEnum = pgEnum('insight_type', INSIGHT_TYPES);
export const insightFeedbackPgEnum = pgEnum('insight_feedback', INSIGHT_FEEDBACKS);
export const idempotencyStatusPgEnum = pgEnum('idempotency_status', IDEMPOTENCY_STATUSES);

// ==========================================
// 2. HELPER RLS POLICY PREDICATES
// ==========================================

export const currentTenantSql = sql`NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`;
export const currentUserSql = sql`NULLIF(current_setting('app.current_user_id', true), '')::uuid`;

// ==========================================
// 3. TABELAS DE BANCO DE DADOS
// ==========================================

/**
 * Usuários da aplicação (gerenciados via Better Auth / OAuth e vinculados ao WhatsApp)
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    avatarUrl: text('avatar_url'),
    whatsappPhone: varchar('whatsapp_phone', { length: 30 }).unique(),
    whatsappVerifiedAt: timestamp('whatsapp_verified_at', { withTimezone: true }),
    status: userStatusPgEnum('status').default('ACTIVE').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_users_whatsapp_phone').on(table.whatsappPhone),
    index('idx_users_email').on(table.email),
    pgPolicy('users_isolation_policy', {
      for: 'all',
      to: 'public',
      using: sql`id = ${currentUserSql}`,
    }),
  ]
);

/**
 * Tenants (workspaces financeiros isolados; 1:1 com usuário no MVP, expansível para multi-usuários)
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    plan: tenantPlanPgEnum('plan').default('BETA').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_tenants_owner_id').on(table.ownerId),
    pgPolicy('tenants_isolation_policy', {
      for: 'all',
      to: 'public',
      using: sql`id = ${currentTenantSql} OR owner_id = ${currentUserSql}`,
    }),
  ]
);

/**
 * Categorias de despesas e receitas associadas a cada tenant
 */
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    type: transactionTypePgEnum('type').notNull(),
    icon: varchar('icon', { length: 50 }),
    color: varchar('color', { length: 30 }),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_categories_tenant_name_type').on(table.tenantId, table.name, table.type),
    index('idx_categories_tenant_id').on(table.tenantId),
    pgPolicy('categories_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: sql`tenant_id = ${currentTenantSql}`,
      withCheck: sql`tenant_id = ${currentTenantSql}`,
    }),
  ]
);

/**
 * Transações financeiras confirmadas e imutáveis
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    type: transactionTypePgEnum('type').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    description: varchar('description', { length: 255 }).notNull(),
    paymentMethod: paymentMethodPgEnum('payment_method').default('OTHER').notNull(),
    transactionDate: date('transaction_date').notNull(),
    sourceChannel: sourceChannelPgEnum('source_channel').notNull(),
    confirmedByUser: boolean('confirmed_by_user').default(true).notNull(),
    rawPayload: text('raw_payload'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_transactions_tenant_date').on(table.tenantId, table.transactionDate),
    index('idx_transactions_tenant_category').on(table.tenantId, table.categoryId),
    index('idx_transactions_tenant_type').on(table.tenantId, table.type),
    index('idx_transactions_user_id').on(table.userId),
    pgPolicy('transactions_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: sql`tenant_id = ${currentTenantSql}`,
      withCheck: sql`tenant_id = ${currentTenantSql}`,
    }),
  ]
);

/**
 * Lançamentos temporários pendentes de confirmação do usuário no WhatsApp
 */
export const pendingConfirmations = pgTable(
  'pending_confirmations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    whatsappPhone: varchar('whatsapp_phone', { length: 30 }).notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceChannel: sourceChannelPgEnum('source_channel').notNull(),
    extractedData: jsonb('extracted_data').notNull(),
    rawPayload: text('raw_payload'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_pending_phone').on(table.whatsappPhone),
    index('idx_pending_expires').on(table.expiresAt),
    index('idx_pending_tenant').on(table.tenantId),
    pgPolicy('pending_confirmations_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: sql`tenant_id = ${currentTenantSql}`,
      withCheck: sql`tenant_id = ${currentTenantSql}`,
    }),
  ]
);

/**
 * Análises preditivas, detecções de anomalias e sugestões geradas por IA
 */
export const aiInsights = pgTable(
  'ai_insights',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    type: insightTypePgEnum('type').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(),
    dataPayload: jsonb('data_payload'),
    userFeedback: insightFeedbackPgEnum('user_feedback').default('UNRATED').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_insights_tenant_id').on(table.tenantId),
    index('idx_insights_type').on(table.type),
    pgPolicy('insights_tenant_isolation', {
      for: 'all',
      to: 'public',
      using: sql`tenant_id = ${currentTenantSql}`,
      withCheck: sql`tenant_id = ${currentTenantSql}`,
    }),
  ]
);

/**
 * Trilha de auditoria imutável (Append-only) para LGPD e telemetria de IA
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: varchar('entity_id', { length: 100 }),
    metadata: jsonb('metadata'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_audit_tenant_action').on(table.tenantId, table.action),
    index('idx_audit_created_at').on(table.createdAt),
    pgPolicy('audit_logs_read_policy', {
      for: 'select',
      to: 'public',
      using: sql`tenant_id = ${currentTenantSql} OR ${currentTenantSql} IS NULL`,
    }),
  ]
);

/**
 * Tabela de idempotência e deduplicação de operações sensíveis / webhooks
 */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: varchar('key', { length: 255 }).primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    status: idempotencyStatusPgEnum('status').default('PENDING').notNull(),
    responsePayload: jsonb('response_payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('idx_idempotency_expires_at').on(table.expiresAt),
  ]
);

// ==========================================
// 4. RELAÇÕES ENTRE TABELAS (DRIZZLE RELATIONS)
// ==========================================

export const usersRelations = relations(users, ({ many }) => ({
  tenants: many(tenants),
  transactions: many(transactions),
  auditLogs: many(auditLogs),
}));

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  owner: one(users, {
    fields: [tenants.ownerId],
    references: [users.id],
  }),
  categories: many(categories),
  transactions: many(transactions),
  pendingConfirmations: many(pendingConfirmations),
  aiInsights: many(aiInsights),
  auditLogs: many(auditLogs),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [categories.tenantId],
    references: [tenants.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [transactions.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

export const pendingConfirmationsRelations = relations(pendingConfirmations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pendingConfirmations.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [pendingConfirmations.userId],
    references: [users.id],
  }),
}));

export const aiInsightsRelations = relations(aiInsights, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiInsights.tenantId],
    references: [tenants.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLogs.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
