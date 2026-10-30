/**
 * WKontrolAI — Helper de Execução com Injeção de Contexto de RLS
 * PostgreSQL 16 com Row-Level Security
 */

import { sql } from 'drizzle-orm';
import type { SecurityContext } from '@/types';
import { db, type Database } from './index';

// Interface genérica para o executor do Drizzle
export interface SqlExecutor {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
}

/**
 * Injeta variáveis de sessão locais na transação do PostgreSQL
 * garantindo isolamento estrito de tenant e user por RLS.
 * Utiliza set_config() para compatibilidade plena com parâmetros bindados no protocolo PostgreSQL.
 */
export async function setTenantSession(
  executor: SqlExecutor,
  context: SecurityContext
): Promise<void> {
  await executor.execute(sql`
    SELECT 
      set_config('app.current_tenant_id', ${context.tenantId}, true),
      set_config('app.current_user_id', ${context.userId}, true);
  `);
}

/**
 * Executa uma operação no banco de dados garantindo a injeção
 * do contexto do tenant e usuário para aplicação do Row-Level Security (RLS).
 */
export async function withTenantContext<T>(
  context: SecurityContext,
  operation: (tx: Database) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    await setTenantSession(tx, context);
    return await operation(tx as unknown as Database);
  });
}
