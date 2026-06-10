import { IsIn } from 'class-validator';

export class RespondInheritanceEventDto {
  @IsIn(['cancel', 'pause', 'allow_takeover'])
  action!: 'cancel' | 'pause' | 'allow_takeover';
}
