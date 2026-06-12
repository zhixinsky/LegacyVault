import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminApiKeyGuard } from './common/guards/admin-api-key.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AuthModule } from './modules/auth/auth.module';
import { AlbumModule } from './modules/album/album.module';
import { FileModule } from './modules/file/file.module';
import { ContactTakeoverModule } from './modules/contact-takeover/contact-takeover.module';
import { MfaModule } from './modules/mfa/mfa.module';
import { InheritanceModule } from './modules/inheritance/inheritance.module';
import { NotificationModule } from './modules/notification/notification.module';
import { TrustedContactModule } from './modules/trusted-contact/trusted-contact.module';
import { UserModule } from './modules/user/user.module';
import { VaultModule } from './modules/vault/vault.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuditLogModule,
    AuthModule,
    MfaModule,
    UserModule,
    VaultModule,
    FileModule,
    AlbumModule,
    TrustedContactModule,
    InheritanceModule,
    ContactTakeoverModule,
    NotificationModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AdminApiKeyGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
