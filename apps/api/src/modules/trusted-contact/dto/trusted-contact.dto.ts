import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ContactPermissionScope } from '@prisma/client';

export class CreateTrustedContactDto {
  @IsString()
  @IsNotEmpty()
  nameCiphertext!: string;

  @IsString()
  @IsNotEmpty()
  phoneCiphertext!: string;

  @IsString()
  @IsNotEmpty()
  emailCiphertext!: string;

  @IsOptional()
  @IsString()
  relationCiphertext?: string;

  @IsEnum(ContactPermissionScope)
  permissionScope!: ContactPermissionScope;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsString()
  encryptedVaultKeyForContact?: string;

  @IsOptional()
  @IsString()
  phoneLookupHash?: string;

  @IsOptional()
  @IsString()
  emailLookupHash?: string;

  /** 仅用于数字遗产通知送达，服务端明文存储 */
  @IsOptional()
  @IsString()
  notifyPhone?: string;

  @IsOptional()
  @IsString()
  notifyEmail?: string;
}

export class UpdateTrustedContactDto {
  @IsOptional()
  @IsString()
  nameCiphertext?: string;

  @IsOptional()
  @IsString()
  phoneCiphertext?: string;

  @IsOptional()
  @IsString()
  emailCiphertext?: string;

  @IsOptional()
  @IsString()
  relationCiphertext?: string;

  @IsOptional()
  @IsEnum(ContactPermissionScope)
  permissionScope?: ContactPermissionScope;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  encryptedVaultKeyForContact?: string;

  @IsOptional()
  @IsString()
  phoneLookupHash?: string;

  @IsOptional()
  @IsString()
  emailLookupHash?: string;

  @IsOptional()
  @IsString()
  notifyPhone?: string;

  @IsOptional()
  @IsString()
  notifyEmail?: string;
}

export class CreateContactChallengeDto {
  @IsString()
  @IsNotEmpty()
  contactId!: string;

  @IsString()
  @IsNotEmpty()
  encryptedQuestion!: string;

  @IsString()
  @IsNotEmpty()
  encryptedAnswerHash!: string;

  @IsOptional()
  @IsString()
  questionLabel?: string;

  @IsOptional()
  required?: boolean;
}

export class ListTrustedContactsQueryDto {
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}
