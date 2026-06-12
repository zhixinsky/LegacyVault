import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

class KdfParamsDto {
  @IsString()
  algorithm!: 'argon2id';

  @IsNotEmpty()
  memory!: number;

  @IsNotEmpty()
  iterations!: number;

  @IsNotEmpty()
  parallelism!: number;
}

export class SendCodeDto {
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone!: string;
}

export class LoginWithCodeDto {
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码格式不正确' })
  code!: string;
}

export class WxLoginDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class WechatPhoneDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class ScanConfirmDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class WxBindDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class LoginMfaDto {
  @IsString()
  @IsNotEmpty()
  pendingId!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码格式不正确' })
  code!: string;
}

export class ScanMfaDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码格式不正确' })
  code!: string;
}

export class RegisterDto {
  @IsOptional()
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  /** 注册时绑定微信 openid（小程序 wx.login 的 code） */
  @IsOptional()
  @IsString()
  wxCode?: string;

  /** 客户端加密后的 vault_key，服务器无法解密 */
  @IsString()
  @IsNotEmpty()
  encryptedVaultKey!: string;

  @IsString()
  @IsNotEmpty()
  kdfSalt!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => KdfParamsDto)
  kdfParams!: KdfParamsDto;
}

export class LoginDto {
  @IsOptional()
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码格式不正确' })
  code?: string;
}
