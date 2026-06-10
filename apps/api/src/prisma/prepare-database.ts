import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as mysql from 'mysql2/promise';
import { resolveMysqlConnectionConfig } from './mysql-config';

function escapeIdentifier(name: string) {
  return name.replace(/`/g, '``');
}

function resolvePrismaCliPath() {
  const candidates = [
    join(__dirname, '../../../../node_modules/prisma/build/index.js'),
    join(__dirname, '../../../node_modules/prisma/build/index.js'),
    join(process.cwd(), '../../node_modules/prisma/build/index.js'),
    join(process.cwd(), 'node_modules/prisma/build/index.js'),
  ];

  return candidates.find((path) => existsSync(path));
}

export async function prepareDatabase() {
  const config = resolveMysqlConnectionConfig();
  if (!config) {
    console.warn('[database] 未配置 DATABASE_URL 或 MYSQL_*，跳过建库与迁移');
    return;
  }

  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
  });

  const database = escapeIdentifier(config.database);
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.end();
  console.log(`[database] 已确保数据库存在: ${config.database}`);

  if (process.env.AUTO_MIGRATE === 'false') {
    return;
  }

  const prismaCli = resolvePrismaCliPath();
  if (!prismaCli) {
    console.warn('[database] 未找到 prisma CLI，跳过 db push');
    return;
  }

  const apiRoot = join(__dirname, '../..');
  execSync(`node "${prismaCli}" db push --skip-generate --accept-data-loss`, {
    cwd: apiRoot,
    stdio: 'inherit',
    env: process.env,
  });
  console.log('[database] prisma db push 完成');
}
