import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AddIpBlacklistDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  ip!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
