import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';

import { Request } from 'express';

import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

import { Public } from '../../common/decorators/metadata.decorator';

import { getRequestMeta } from '../../common/utils/request-meta';

import { AuthService } from './auth.service';

import {

  LoginDto,

  LoginWithEmailCodeDto,

  LoginMfaDto,

  LoginWithCodeDto,

  LoginWithPasswordDto,

  RegisterDto,

  ScanConfirmDto,

  ScanMfaDto,

  SendCodeDto,

  SendEmailCodeDto,

  WechatPhoneDto,

  WxBindDto,

  WxLoginDto,

} from './dto/auth.dto';

import { ScanLoginService } from './scan-login.service';
import { WxBindScanService } from './wx-bind-scan.service';



@Controller('auth')

export class AuthController {

  constructor(

    private readonly authService: AuthService,

    private readonly scanLoginService: ScanLoginService,

    private readonly wxBindScanService: WxBindScanService,

  ) {}



  @Public()

  @Post('register')

  register(@Body() dto: RegisterDto, @Req() req: Request) {

    return this.authService.register(dto, getRequestMeta(req));

  }



  @Public()

  @Post('send-code')

  sendCode(@Body() dto: SendCodeDto, @Req() req: Request) {

    return this.authService.sendCode(dto, getRequestMeta(req));

  }



  @Public()

  @Post('send-email-code')

  sendEmailCode(@Body() dto: SendEmailCodeDto, @Req() req: Request) {

    return this.authService.sendEmailCode(dto, getRequestMeta(req));

  }



  @Public()

  @Post('login-with-code')

  loginWithCode(@Body() dto: LoginWithCodeDto, @Req() req: Request) {

    return this.authService.loginWithCode(dto, getRequestMeta(req));

  }



  @Public()

  @Post('login-with-email-code')

  loginWithEmailCode(@Body() dto: LoginWithEmailCodeDto, @Req() req: Request) {

    return this.authService.loginWithEmailCode(dto, getRequestMeta(req));

  }



  @Public()

  @Post('login-with-password')

  loginWithPassword(@Body() dto: LoginWithPasswordDto, @Req() req: Request) {

    return this.authService.loginWithPassword(dto, getRequestMeta(req));

  }



  @Public()

  @Post('login-mfa')

  loginMfa(@Body() dto: LoginMfaDto) {

    return this.authService.verifyPendingMfa(dto.pendingId, dto.code);

  }



  @Public()

  @Post('login')

  login(@Body() dto: LoginDto, @Req() req: Request) {

    return this.authService.login(dto, getRequestMeta(req));

  }



  @Public()

  @Post('wx-login')

  wxLogin(

    @Body() dto: WxLoginDto,

    @Req() req: Request,

    @Headers('x-wx-openid') headerOpenid?: string,

  ) {

    return this.authService.wxLogin(dto, getRequestMeta(req), headerOpenid);

  }



  @Public()

  @Post('wechat/phone-number')

  wechatPhoneNumber(@Body() dto: WechatPhoneDto) {

    return this.authService.resolveWechatPhone(dto);

  }



  @Public()

  @Post('wechat-phone-login')

  wechatPhoneLogin(@Body() dto: WechatPhoneDto, @Req() req: Request) {

    return this.authService.wechatPhoneLogin(dto, getRequestMeta(req));

  }



  @Public()

  @Post('scan/create')

  createScanSession() {

    return this.scanLoginService.createSession();

  }



  @Public()

  @Get('scan/:scanId/status')

  getScanStatus(@Param('scanId') scanId: string, @Req() req: Request) {

    return this.scanLoginService.getStatus(scanId, getRequestMeta(req));

  }



  @Public()

  @Post('scan/:scanId/confirm')

  confirmScan(

    @Param('scanId') scanId: string,

    @Body() dto: ScanConfirmDto,

    @Req() req: Request,

  ) {

    return this.scanLoginService.confirmWithCode(scanId, dto.code, getRequestMeta(req));

  }



  @Public()

  @Post('scan/:scanId/verify-mfa')

  verifyScanMfa(@Param('scanId') scanId: string, @Body() dto: ScanMfaDto) {

    return this.scanLoginService.verifyMfa(scanId, dto.code);

  }



  @Post('scan/:scanId/approve')

  approveScan(

    @Param('scanId') scanId: string,

    @CurrentUser() user: AuthUser,

    @Req() req: Request,

  ) {

    return this.scanLoginService.approveByUser(scanId, user.userId, getRequestMeta(req));

  }



  @Post('wx-bind/scan/create')

  createWxBindScan(@CurrentUser() user: AuthUser) {

    return this.wxBindScanService.createSession(user.userId);

  }



  @Get('wx-bind/scan/:bindId/status')

  getWxBindScanStatus(@CurrentUser() user: AuthUser, @Param('bindId') bindId: string) {

    return this.wxBindScanService.getStatus(bindId, user.userId);

  }



  @Public()

  @Post('wx-bind/scan/:bindId/confirm')

  confirmWxBindScan(

    @Param('bindId') bindId: string,

    @Body() dto: WxBindDto,

    @Req() req: Request,

  ) {

    return this.wxBindScanService.confirmWithCode(bindId, dto.code, getRequestMeta(req));

  }



  @Post('me/wechat/bind')

  bindWechat(

    @CurrentUser() user: AuthUser,

    @Body() dto: WxBindDto,

    @Req() req: Request,

  ) {

    return this.authService.bindWechat(user.userId, dto.code, getRequestMeta(req));

  }



  @Post('me/wechat/unbind')

  unbindWechat(@CurrentUser() user: AuthUser, @Req() req: Request) {

    return this.authService.unbindWechat(user.userId, getRequestMeta(req));

  }



  @Post('me/phone/bind')

  bindPhone(

    @CurrentUser() user: AuthUser,

    @Body() dto: WechatPhoneDto,

    @Req() req: Request,

  ) {

    return this.authService.bindPhoneByWechat(user.userId, dto.code, getRequestMeta(req));

  }



  @Post('me/email/bind')

  bindEmail(

    @CurrentUser() user: AuthUser,

    @Body() dto: LoginWithEmailCodeDto,

    @Req() req: Request,

  ) {

    return this.authService.bindEmailByCode(user.userId, dto.email, dto.code, getRequestMeta(req));

  }

}


