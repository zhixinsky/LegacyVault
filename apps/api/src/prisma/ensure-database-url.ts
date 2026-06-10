import { buildDatabaseUrl, resolveMysqlConnectionConfig } from './mysql-config';

export function resolveDatabaseUrl(): string | undefined {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct) {
    return direct;
  }

  const config = resolveMysqlConnectionConfig();
  if (!config) {
    return undefined;
  }

  return buildDatabaseUrl(config);
}

export function ensureDatabaseUrl() {
  const resolved = resolveDatabaseUrl();
  if (resolved) {
    process.env.DATABASE_URL = resolved;
  }
}

ensureDatabaseUrl();
