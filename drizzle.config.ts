import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

// Valores base e fallbacks consistentes com o docker-compose.yml
let user = process.env.POSTGRES_USER || 'postgres';
let password = process.env.POSTGRES_PASSWORD || 'wkontrol_secret';
let host = process.env.POSTGRES_HOST || (process.env.NODE_ENV === 'production' ? 'postgres' : 'localhost');
let port = Number(process.env.POSTGRES_PORT) || 5432;
let database = process.env.POSTGRES_DB || 'wkontrolai';

if (databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.hostname) host = parsed.hostname;
    if (parsed.port) port = Number(parsed.port);
    if (parsed.username) user = decodeURIComponent(parsed.username);
    if (parsed.password) password = decodeURIComponent(parsed.password);
    if (parsed.pathname && parsed.pathname.length > 1) {
      database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    }
  } catch {
    // Parser alternativo via regex caso a URL possua caracteres especiais
    const match = databaseUrl.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/(.+)$/);
    if (match) {
      user = match[1];
      password = match[2];
      host = match[3];
      port = match[4] ? Number(match[4]) : 5432;
      database = match[5];
    }
  }
}

// Garante que o usuário nunca seja vazio ou caia no OS username do container ('worker' ou 'nextjs')
if (!user || user === 'worker' || user === 'nextjs') {
  user = process.env.POSTGRES_USER || 'postgres';
}
if (!user || user === 'worker' || user === 'nextjs') {
  user = 'postgres';
}
if (!password) {
  password = process.env.POSTGRES_PASSWORD || 'wkontrol_secret';
}

process.env.PGUSER = user;
process.env.PGPASSWORD = password;
process.env.PGHOST = host;
process.env.PGPORT = String(port);
process.env.PGDATABASE = database;

const computedUrl = databaseUrl || `postgres://${user}:${password}@${host}:${port}/${database}`;

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: computedUrl,
    host,
    port,
    user,
    password,
    database,
    ssl: false,
  },
});
