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

export class SendEmailCodeDto {
  @IsEmail()
  email!: string;
}

export class LoginWithCodeDto {
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码格式不正确' })
  code!: string;
}

export class LoginWithEmailCodeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码格式不正确' })
  code!: string;
}

export class LoginWithPasswordDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,32}$/, { message: '用户名仅支持 3-32 位字母、数字或下划线' })
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
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
  @Matches(/^[a-zA-Z0-9_]{3,32}$/, { message: '用户名仅支持 3-32 位字母、数字或下划线' })
  username?: string;

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

  @IsOptional()
  @IsString()
  password?: string;

  /** 客户端加密后的 vault_key，服务器无法解密。旧注册流程兼容字段。 */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  encryptedVaultKey?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  kdfSalt?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => KdfParamsDto)
  kdfParams?: KdfParamsDto;
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
