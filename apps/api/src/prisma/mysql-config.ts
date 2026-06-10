function encodeCredential(value: string) {
  return encodeURIComponent(value);
}

export interface MysqlConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function resolveMysqlConnectionConfig(): MysqlConnectionConfig | undefined {
  const address = process.env.MYSQL_ADDRESS?.trim();
  const username = process.env.MYSQL_USERNAME?.trim();
  const password = process.env.MYSQL_PASSWORD;

  if (address && username && password !== undefined && password !== '') {
    let host = address;
    let port = Number(process.env.MYSQL_PORT?.trim() || '3306');

    const colonIndex = address.lastIndexOf(':');
    if (colonIndex > 0) {
      const maybePort = address.slice(colonIndex + 1);
      if (/^\d+$/.test(maybePort)) {
        host = address.slice(0, colonIndex);
        port = Number(maybePort);
      }
    }

    return {
      host,
      port,
      user: username,
      password,
      database:
        process.env.MYSQL_DATABASE?.trim() ||
        process.env.MYSQL_DB?.trim() ||
        'vaultpass',
    };
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return undefined;
  }

  try {
    const url = new URL(databaseUrl);
    if (url.protocol !== 'mysql:') {
      return undefined;
    }

    const database = url.pathname.replace(/^\//, '');
    if (!database) {
      return undefined;
    }

    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database,
    };
  } catch {
    return undefined;
  }
}

export function buildDatabaseUrl(config: MysqlConnectionConfig) {
  return `mysql://${encodeCredential(config.user)}:${encodeCredential(config.password)}@${config.host}:${config.port}/${config.database}`;
}
