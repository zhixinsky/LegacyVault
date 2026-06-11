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
    const hasColumn = async (columnName: string) => {
      const [columns] = await connection.query(
        `SELECT COLUMN_NAME AS columnName
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
        [config.database, columnName],
      );
      return (columns as Array<{ columnName: string }>).length > 0;
    };

    if (!(await hasColumn('username'))) {
      console.log('[database] 检测到 users.username 缺失，开始添加字段');
      await connection.query('ALTER TABLE `users` ADD COLUMN `username` VARCHAR(64) NULL');
      console.log('[database] users.username 字段添加完成');
    }

    if (!(await hasColumn('has_vault'))) {
      console.log('[database] 检测到 users.has_vault 缺失，开始添加字段');
      await connection.query(
        'ALTER TABLE `users` ADD COLUMN `has_vault` BOOLEAN NOT NULL DEFAULT false',
      );
      await connection.query(
        'UPDATE `users` SET `has_vault` = true WHERE `encrypted_vault_key` IS NOT NULL',
      );
      console.log('[database] users.has_vault 字段添加并回填完成');
    }

    if (await hasColumn('encrypted_vault_key')) {
      await connection.query('ALTER TABLE `users` MODIFY COLUMN `encrypted_vault_key` LONGTEXT NULL');
    }

    if (await hasColumn('kdf_salt')) {
      await connection.query('ALTER TABLE `users` MODIFY COLUMN `kdf_salt` VARCHAR(128) NULL');
    }

    if (await hasColumn('kdf_params')) {
      await connection.query('ALTER TABLE `users` MODIFY COLUMN `kdf_params` JSON NULL');
    }

    if (!(await hasColumn('password_salt'))) {
      console.log('[database] 检测到 users.password_salt 缺失，开始添加字段');
      await connection.query('ALTER TABLE `users` ADD COLUMN `password_salt` VARCHAR(128) NULL');
      if (await hasColumn('kdf_salt')) {
        await connection.query(
          'UPDATE `users` SET `password_salt` = `kdf_salt` WHERE `password_salt` IS NULL',
        );
      }
      console.log('[database] users.password_salt 字段添加并回填完成');
    }

    if (!(await hasColumn('recovery_salt'))) {
      console.log('[database] 检测到 users.recovery_salt 缺失，开始添加字段');
      await connection.query('ALTER TABLE `users` ADD COLUMN `recovery_salt` VARCHAR(128) NULL');
      console.log('[database] users.recovery_salt 字段添加完成');
    }

    if (!(await hasColumn('vault_created_at'))) {
      console.log('[database] 检测到 users.vault_created_at 缺失，开始添加字段');
      await connection.query('ALTER TABLE `users` ADD COLUMN `vault_created_at` DATETIME NULL');
      await connection.query(
        'UPDATE `users` SET `vault_created_at` = `created_at` WHERE `vault_created_at` IS NULL AND `encrypted_vault_key` IS NOT NULL',
      );
      console.log('[database] users.vault_created_at 字段添加并回填完成');
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
