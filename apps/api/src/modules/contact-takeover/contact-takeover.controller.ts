import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/metadata.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { ContactTakeoverService } from './contact-takeover.service';
import {
  SendContactTakeoverOtpDto,
  StartContactTakeoverDto,
  VerifyContactTakeoverChallengesDto,
  VerifyContactTakeoverOtpDto,
} from './dto/contact-takeover.dto';

@Controller('contact-takeover')
@Public()
export class ContactTakeoverController {
  constructor(private readonly contactTakeoverService: ContactTakeoverService) {}

  @Post('start')
  start(@Body() dto: StartContactTakeoverDto) {
    return this.contactTakeoverService.startSession(dto.token);
  }

  @Get(':sessionId/status')
  status(@Param('sessionId') sessionId: string) {
    return this.contactTakeoverService.getSessionStatus(sessionId);
  }

  @Post(':sessionId/send-otp')
  sendOtp(@Param('sessionId') sessionId: string, @Body() dto: SendContactTakeoverOtpDto) {
    return this.contactTakeoverService.sendOtp(sessionId, dto);
  }

  @Post(':sessionId/verify-otp')
  verifyOtp(@Param('sessionId') sessionId: string, @Body() dto: VerifyContactTakeoverOtpDto) {
    return this.contactTakeoverService.verifyOtp(sessionId, dto.code);
  }

  @Get(':sessionId/challenges')
  challenges(@Param('sessionId') sessionId: string) {
    return this.contactTakeoverService.listChallenges(sessionId);
  }

  @Post(':sessionId/verify-challenges')
  verifyChallenges(
    @Param('sessionId') sessionId: string,
    @Body() dto: VerifyContactTakeoverChallengesDto,
  ) {
    return this.contactTakeoverService.verifyChallenges(sessionId, dto);
  }

  @Post(':sessionId/complete')
  complete(@Param('sessionId') sessionId: string) {
    return this.contactTakeoverService.completeSession(sessionId);
  }

  @Get(':sessionId/vault/items')
  listVaultItems(
    @Param('sessionId') sessionId: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
  ) {
    return this.contactTakeoverService.listVaultItems(
      sessionId,
      type,
      page ? Number(page) : 1,
    );
  }

  @Get(':sessionId/vault/files')
  listFiles(@Param('sessionId') sessionId: string, @Query('page') page?: string) {
    return this.contactTakeoverService.listFiles(sessionId, page ? Number(page) : 1);
  }

  @Get(':sessionId/vault/files/:fileId/download')
  @SkipTransform()
  async downloadFile(
    @Param('sessionId') sessionId: string,
    @Param('fileId') fileId: string,
  ) {
    const result = await this.contactTakeoverService.downloadFile(sessionId, fileId);
    return result.stream;
  }
}
