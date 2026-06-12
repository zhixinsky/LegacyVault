import { IsNotEmpty, IsString, Length } from 'class-validator';

export class EnableMfaDto {
  @IsString()
  @IsNotEmpty()
  secret!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

export class MfaCodeDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
