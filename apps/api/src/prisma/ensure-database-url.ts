/**
 * 微信云托管绑定 MySQL 时注入 MYSQL_ADDRESS / MYSQL_USERNAME / MYSQL_PASSWORD，
 * Prisma 需要 DATABASE_URL，在此自动拼接。
 */
function encodeCredential(value: string) {
  return encodeURIComponent(value);
}

export function resolveDatabaseUrl(): string | undefined {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct) {
    return direct;
  }

  const address = process.env.MYSQL_ADDRESS?.trim();
  const username = process.env.MYSQL_USERNAME?.trim();
  const password = process.env.MYSQL_PASSWORD;

  if (!address || !username || password === undefined || password === '') {
    return undefined;
  }

  let host = address;
  let port = process.env.MYSQL_PORT?.trim() || '3306';

  const colonIndex = address.lastIndexOf(':');
  if (colonIndex > 0) {
    const maybePort = address.slice(colonIndex + 1);
    if (/^\d+$/.test(maybePort)) {
      host = address.slice(0, colonIndex);
      port = maybePort;
    }
  }

  const database =
    process.env.MYSQL_DATABASE?.trim() ||
    process.env.MYSQL_DB?.trim() ||
    'vaultpass';

  return `mysql://${encodeCredential(username)}:${encodeCredential(password)}@${host}:${port}/${database}`;
}

export function ensureDatabaseUrl() {
  const resolved = resolveDatabaseUrl();
  if (resolved) {
    process.env.DATABASE_URL = resolved;
  }
}

ensureDatabaseUrl();
