import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';

export class StartContactTakeoverDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class SendContactTakeoverOtpDto {
  @IsIn(['sms', 'email'])
  channel!: 'sms' | 'email';

  @IsString()
  @IsNotEmpty()
  target!: string;
}

export class VerifyContactTakeoverOtpDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class VerifyChallengeAnswerDto {
  @IsString()
  @IsNotEmpty()
  challengeId!: string;

  @IsString()
  @IsNotEmpty()
  answer!: string;
}

export class VerifyContactTakeoverChallengesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VerifyChallengeAnswerDto)
  answers!: VerifyChallengeAnswerDto[];
}
