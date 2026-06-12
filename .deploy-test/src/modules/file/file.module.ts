import { Module } from '@nestjs/common';
import { MfaModule } from '../mfa/mfa.module';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { StorageService } from './storage.service';
import { WechatCosService } from './wechat-cos.service';

@Module({
  imports: [MfaModule],
  controllers: [FileController],
  providers: [FileService, StorageService, WechatCosService],
  exports: [FileService, StorageService],
})
export class FileModule {}
