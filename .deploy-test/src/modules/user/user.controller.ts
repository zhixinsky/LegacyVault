import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { MfaCode } from '../../common/decorators/mfa-code.decorator';
import { getRequestMeta } from '../../common/utils/request-meta';
import { EnableMfaDto, MfaCodeDto } from './dto/mfa.dto';
import { SetupRecoveryKeyDto } from './dto/recovery-key.dto';
import { UpdateUserDto } from './dto/user.dto';
import { MfaService } from './mfa.service';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly mfaService: MfaService,
  ) {}

  @Get('me')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.userService.getProfile(user.userId);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ) {
    return this.userService.updateProfile(user.userId, dto, getRequestMeta(req));
  }

  @Post('me/heartbeat')
  heartbeat(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.userService.heartbeat(user.userId, getRequestMeta(req));
  }

  @Put('me/recovery-key')
  setupRecoveryKey(
    @CurrentUser() user: AuthUser,
    @Body() dto: SetupRecoveryKeyDto,
    @MfaCode() mfaCode: string | undefined,
    @Req() req: Request,
  ) {
    return this.userService.setupRecoveryKey(user.userId, dto, {
      ...getRequestMeta(req),
      mfaCode,
    });
  }

  @Get('me/devices')
  listDevices(@CurrentUser() user: AuthUser) {
    return this.userService.listDevices(user.userId);
  }

  @Delete('me/devices/:id')
  revokeDevice(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.userService.revokeDevice(user.userId, id, getRequestMeta(req));
  }

  @Post('me/mfa/setup')
  setupMfa(@CurrentUser() user: AuthUser) {
    return this.mfaService.createSetupPayload(user.userId);
  }

  @Post('me/mfa/enable')
  enableMfa(
    @CurrentUser() user: AuthUser,
    @Body() dto: EnableMfaDto,
    @Req() req: Request,
  ) {
    return this.mfaService.enableMfa(user.userId, dto.secret, dto.code, getRequestMeta(req));
  }

  @Post('me/mfa/disable')
  disableMfa(
    @CurrentUser() user: AuthUser,
    @Body() dto: MfaCodeDto,
    @Req() req: Request,
  ) {
    return this.mfaService.disableMfa(user.userId, dto.code, getRequestMeta(req));
  }

  @Post('me/mfa/verify')
  verifyMfa(@CurrentUser() user: AuthUser, @Body() dto: MfaCodeDto) {
    return this.mfaService.verifyUserCode(user.userId, dto.code).then(() => ({ verified: true }));
  }

  @Post('me/export/audit')
  logDataExport(
    @CurrentUser() user: AuthUser,
    @MfaCode() mfaCode: string | undefined,
    @Req() req: Request,
  ) {
    return this.userService.logDataExport(user.userId, {
      ...getRequestMeta(req),
      mfaCode,
    });
  }
}
