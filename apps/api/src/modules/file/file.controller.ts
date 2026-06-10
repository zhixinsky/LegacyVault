import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { memoryStorage } from 'multer';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { MfaCode } from '../../common/decorators/mfa-code.decorator';
import { Public } from '../../common/decorators/metadata.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { getRequestMeta } from '../../common/utils/request-meta';
import { ListFilesQueryDto, RegisterFileDto } from './dto/file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { FileService } from './file.service';

@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Public()
  @Get('cloud-url')
  getCloudUrl(@Query('fileId') fileId: string, @Query('maxAge') maxAge?: string) {
    return this.fileService.getPublicCloudUrl(fileId, maxAge);
  }

  @Public()
  @Get('cloud-image')
  @SkipTransform()
  getCloudImage(@Query('fileId') fileId: string) {
    return this.fileService.getPublicCloudImage(fileId);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListFilesQueryDto) {
    return this.fileService.list(user.userId, query);
  }

  @Get(':id/download')
  @SkipTransform()
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @MfaCode() mfaCode: string | undefined,
    @Req() req: Request,
  ) {
    const result = await this.fileService.download(user.userId, id, {
      ...getRequestMeta(req),
      mfaCode,
    });
    return result.stream;
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fileService.getById(user.userId, id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  async upload(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterFileDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('缺少加密文件内容');
    }

    return this.fileService.uploadEncrypted(
      user.userId,
      dto,
      file.buffer,
      getRequestMeta(req),
    );
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateFileDto,
    @Req() req: Request,
  ) {
    return this.fileService.update(user.userId, id, dto, getRequestMeta(req));
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    return this.fileService.remove(user.userId, id, getRequestMeta(req));
  }
}
