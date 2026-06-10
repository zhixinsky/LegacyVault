import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as mysql from 'mysql2/promise';
import { resolveMysqlConnectionConfig } from './mysql-config';

function escapeIdentifier(name: string) {
  return name.replace(/`/g, '``');
}

function resolveInitSqlPath() {
  const candidates = [
    join(__dirname, '../../prisma/init.sql'),
    join(process.cwd(), 'prisma/init.sql'),
  ];
  return candidates.find((path) => existsSync(path));
}

async function countTables(config: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}) {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  });

  try {
    const [rows] = await connection.query(
      'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ?',
      [config.database],
    );
    const first = (rows as Array<{ count: number }>)[0];
    return Number(first?.count ?? 0);
  } finally {
    await connection.end();
  }
}

async function applyInitSql(config: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}) {
  const initSqlPath = resolveInitSqlPath();
  if (!initSqlPath) {
    console.warn('[database] 未找到 prisma/init.sql，跳过建表');
    return false;
  }

  const sql = readFileSync(initSqlPath, 'utf8').trim();
  if (!sql) {
    console.warn('[database] prisma/init.sql 为空，跳过建表');
    return false;
  }

  console.log(`[database] 开始执行 init.sql (${initSqlPath})`);
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    multipleStatements: true,
  });

  try {
    await connection.query(sql);
    console.log('[database] init.sql 执行完成');
    return true;
  } finally {
    await connection.end();
  }
}

export async function prepareDatabase() {
  const config = resolveMysqlConnectionConfig();
  if (!config) {
    console.warn('[database] 未配置 DATABASE_URL 或 MYSQL_*，跳过建库与迁移');
    return;
  }

  const bootstrapConnection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
  });

  const database = escapeIdentifier(config.database);
  await bootstrapConnection.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await bootstrapConnection.end();
  console.log(`[database] 已确保数据库存在: ${config.database}`);

  if (process.env.AUTO_MIGRATE === 'false') {
    return;
  }

  const tableCount = await countTables(config);
  if (tableCount > 0) {
    console.log(`[database] 已存在 ${tableCount} 张表，跳过建表`);
    return;
  }

  await applyInitSql(config);
}
