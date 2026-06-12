/**
 * 将本地 storage_path 迁移到微信云托管 COS。
 * 用法：pnpm --filter @vaultpass/api exec ts-node scripts/migrate-local-to-cos.ts
 * 需配置 STORAGE_PROVIDER=wechat_cos 及 COS 相关环境变量。
 */
import { NestFactory } from '@nestjs/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { WechatCosService } from '../src/modules/file/wechat-cos.service';
import { ConfigService } from '@nestjs/config';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const prisma = app.get(PrismaService);
  const cos = app.get(WechatCosService);
  const config = app.get(ConfigService);

  if (!cos.isEnabled()) {
    console.error('STORAGE_PROVIDER 未设为 wechat_cos，无法迁移');
    process.exit(1);
  }

  const storageRoot = config.get<string>('STORAGE_PATH', join(process.cwd(), 'storage'));
  const dryRun = ['1', 'true', 'yes'].includes(String(process.env.MIGRATE_DRY_RUN ?? '').toLowerCase());

  const files = await prisma.vaultFile.findMany({
    where: { NOT: { storagePath: { startsWith: 'cloud://' } } },
    select: { id: true, storagePath: true, userId: true },
  });

  console.log(`待迁移文件：${files.length} 个${dryRun ? '（试运行）' : ''}`);

  let migrated = 0;
  let failed = 0;

  for (const file of files) {
    const localPath = join(storageRoot, file.storagePath);
    try {
      const buffer = await readFile(localPath);
      if (dryRun) {
        console.log(`[dry-run] ${file.id} -> COS (${buffer.length} bytes)`);
        migrated += 1;
        continue;
      }

      const cloudPath = await cos.upload(file.storagePath, buffer);
      await prisma.vaultFile.update({
        where: { id: file.id },
        data: { storagePath: cloudPath },
      });
      console.log(`已迁移 ${file.id}`);
      migrated += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `迁移失败 ${file.id} (${localPath}):`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log(`完成：成功 ${migrated}，失败 ${failed}`);
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
