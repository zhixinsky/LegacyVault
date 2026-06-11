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

async function ensureUserSchema(config: {
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
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME AS columnName
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'username'`,
      [config.database],
    );

    if ((columns as Array<{ columnName: string }>).length === 0) {
      console.log('[database] 检测到 users.username 缺失，开始添加字段');
      await connection.query('ALTER TABLE `users` ADD COLUMN `username` VARCHAR(64) NULL');
      console.log('[database] users.username 字段添加完成');
    }

    const [indexes] = await connection.query(
      `SELECT INDEX_NAME AS indexName
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND INDEX_NAME = 'users_username_key'`,
      [config.database],
    );

    if ((indexes as Array<{ indexName: string }>).length === 0) {
      console.log('[database] 检测到 users.username 唯一索引缺失，开始创建索引');
      await connection.query('CREATE UNIQUE INDEX `users_username_key` ON `users`(`username`)');
      console.log('[database] users.username 唯一索引创建完成');
    }
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
    console.log(`[database] 已存在 ${tableCount} 张表，开始检查增量字段`);
    await ensureUserSchema(config);
    return;
  }

  await applyInitSql(config);
  await ensureUserSchema(config);
}
