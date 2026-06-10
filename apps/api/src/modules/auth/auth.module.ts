import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { InheritanceModule } from '../inheritance/inheritance.module';
import { MfaModule } from '../mfa/mfa.module';
import { NotificationModule } from '../notification/notification.module';
import { SecurityModule } from '../security/security.module';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { ScanLoginService } from './scan-login.service';
import { WechatAuthService } from './wechat-auth.service';
import { WxBindScanService } from './wx-bind-scan.service';

@Module({
  imports: [
    InheritanceModule,
    MfaModule,
    NotificationModule,
    SecurityModule,
    UserModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'change-me-in-production'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') as `${number}d`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, ScanLoginService, WxBindScanService, WechatAuthService, JwtStrategy],
  exports: [AuthService, WechatAuthService, JwtModule],
})
export class AuthModule {}
