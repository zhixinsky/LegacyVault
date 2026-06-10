import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { WechatCosService } from './wechat-cos.service';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;
  private readonly localFallback: boolean;

  constructor(
    config: ConfigService,
    private readonly wechatCos: WechatCosService,
  ) {
    this.root = config.get<string>('STORAGE_PATH', join(process.cwd(), 'storage'));
    this.localFallback = ['1', 'true', 'yes'].includes(
      String(config.get<string>('STORAGE_LOCAL_FALLBACK') ?? 'false').toLowerCase(),
    );
  }

  private resolvePath(relativePath: string) {
    return join(this.root, relativePath);
  }

  private isCloudPath(storagePath: string) {
    return storagePath.startsWith('cloud://');
  }

  async save(relativePath: string, data: Buffer) {
    if (this.wechatCos.isEnabled()) {
      try {
        return await this.wechatCos.upload(relativePath, data);
      } catch (error) {
        this.logger.warn(
          `COS 上传失败，${this.localFallback ? '回退本地存储' : '终止'}: ${
            error instanceof Error ? error.message : error
          }`,
        );
        if (!this.localFallback) {
          throw error;
        }
      }
    }

    const fullPath = this.resolvePath(relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
    return relativePath;
  }

  async read(storagePath: string) {
    if (this.isCloudPath(storagePath)) {
      return this.wechatCos.read(storagePath);
    }

    const fullPath = this.resolvePath(storagePath);
    return readFile(fullPath);
  }

  async remove(storagePath: string) {
    if (this.isCloudPath(storagePath)) {
      await this.wechatCos.remove(storagePath).catch(() => undefined);
      return;
    }

    const fullPath = this.resolvePath(storagePath);
    await unlink(fullPath);
  }
}
