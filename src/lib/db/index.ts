/**
 * WKontrolAI — Database Connection & Drizzle ORM Instance
 * PostgreSQL 16 com suporte a Row-Level Security (RLS)
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let user = process.env.POSTGRES_USER || 'postgres';
let password = process.env.POSTGRES_PASSWORD || 'wkontrol_secret';
let host = process.env.POSTGRES_HOST || (process.env.NODE_ENV === 'production' ? 'postgres' : 'localhost');
let port = Number(process.env.POSTGRES_PORT) || 5432;
let database = process.env.POSTGRES_DB || 'wkontrolai';

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.hostname) host = parsed.hostname;
    if (parsed.port) port = Number(parsed.port);
    if (parsed.username && parsed.username !== 'nextjs' && parsed.username !== 'worker') {
      user = decodeURIComponent(parsed.username);
    }
    if (parsed.password) {
      password = decodeURIComponent(parsed.password);
    }
    if (parsed.pathname && parsed.pathname.length > 1) {
      database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    }
  } catch {
    const match = databaseUrl.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/(.+)$/);
    if (match) {
      if (match[1] && match[1] !== 'nextjs' && match[1] !== 'worker') {
        user = match[1];
      }
      if (match[2]) {
        password = match[2];
      }
      host = match[3];
      port = match[4] ? Number(match[4]) : 5432;
      database = match[5];
    }
  }
}

// Bloqueio rigoroso contra fallback para usuários de SO Linux do container
if (!user || user === 'nextjs' || user === 'worker') {
  user = process.env.POSTGRES_USER || 'postgres';
}
if (!user || user === 'nextjs' || user === 'worker') {
  user = 'postgres';
}
if (!password) {
  password = process.env.POSTGRES_PASSWORD || 'wkontrol_secret';
}

// Configura variáveis de ambiente do PostgreSQL para que qualquer driver interno as leia
process.env.PGUSER = user;
process.env.PGPASSWORD = password;
process.env.PGHOST = host;
process.env.PGPORT = String(port);
process.env.PGDATABASE = database;

// Conexão direta usando objeto de opções estrito com usuário e senha explícitos
const connectionOptions: postgres.Options<{}> = {
  host,
  port,
  database,
  username: user,
  password: password,
  user: user,
  pass: password,
  prepare: false,
  max: process.env.NODE_ENV === 'production' ? 20 : 5,
  idle_timeout: 20,
  connect_timeout: 10,
};

// Instância de conexão singleton do postgres
declare global {
  // eslint-disable-next-line no-var
  var __db_client: postgres.Sql | undefined;
}

export const client = globalThis.__db_client ?? postgres(connectionOptions);

if (process.env.NODE_ENV !== 'production') {
  globalThis.__db_client = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;

export * from './schema';
export { withTenantContext, setTenantSession } from './rls';
