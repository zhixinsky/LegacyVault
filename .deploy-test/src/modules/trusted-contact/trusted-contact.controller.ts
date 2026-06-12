import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { MfaCode } from '../../common/decorators/mfa-code.decorator';
import { getRequestMeta } from '../../common/utils/request-meta';
import {
  CreateContactChallengeDto,
  CreateTrustedContactDto,
  ListTrustedContactsQueryDto,
  UpdateTrustedContactDto,
} from './dto/trusted-contact.dto';
import { TrustedContactService } from './trusted-contact.service';

@Controller('trusted-contacts')
export class TrustedContactController {
  constructor(private readonly trustedContactService: TrustedContactService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListTrustedContactsQueryDto) {
    return this.trustedContactService.list(user.userId, query);
  }

  @Post('challenges')
  addChallenge(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateContactChallengeDto,
    @MfaCode() mfaCode: string | undefined,
    @Req() req: Request,
  ) {
    return this.trustedContactService.addChallenge(user.userId, dto, {
      ...getRequestMeta(req),
      mfaCode,
    });
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.trustedContactService.getById(user.userId, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTrustedContactDto,
    @MfaCode() mfaCode: string | undefined,
    @Req() req: Request,
  ) {
    return this.trustedContactService.create(user.userId, dto, {
      ...getRequestMeta(req),
      mfaCode,
    });
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTrustedContactDto,
    @MfaCode() mfaCode: string | undefined,
    @Req() req: Request,
  ) {
    return this.trustedContactService.update(user.userId, id, dto, {
      ...getRequestMeta(req),
      mfaCode,
    });
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @MfaCode() mfaCode: string | undefined,
    @Req() req: Request,
  ) {
    return this.trustedContactService.remove(user.userId, id, {
      ...getRequestMeta(req),
      mfaCode,
    });
  }
}
