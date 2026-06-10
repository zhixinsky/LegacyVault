import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  extractSmsVariables,
  resolveTemplateType,
  VAULTPASS_SMS_TEMPLATES,
  type VaultPassSmsTemplateType,
} from './sms-templates';
import { createEmayTemplate, queryEmayTemplate, sendEmayVariableSms } from './emay-sms.client';

@Injectable()
export class EmaySmsService implements OnModuleInit {
  private readonly logger = new Logger(EmaySmsService.name);
  private enabled = false;
  private autoCreate = false;
  private clientConfig: { appId: string; secretKey: string; baseUrl: string } | null = null;
  private activeTemplateIds: Partial<Record<VaultPassSmsTemplateType, string>> = {};
  private templateReady: Partial<Record<VaultPassSmsTemplateType, boolean>> = {};

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const appId = this.config.get<string>('EMAY_APPID');
    const secretKey = this.config.get<string>('EMAY_SECRETKEY');
    const provider = this.config.get<string>('SMS_PROVIDER');

    if (provider !== 'emay' || !appId || !secretKey) {
      if (provider === 'emay') {
        this.logger.warn('亿美短信未配置 EMAY_APPID / EMAY_SECRETKEY，短信将仅记录日志');
      }
      return;
    }

    this.enabled = true;
    this.autoCreate = !['0', 'false'].includes(
      String(this.config.get<string>('EMAY_AUTO_CREATE_TEMPLATES') ?? 'false').toLowerCase(),
    );
    this.clientConfig = {
      appId,
      secretKey,
      baseUrl: this.config.get<string>('EMAY_BASE_URL') || 'http://www.btom.cn:8080',
    };

    for (const type of Object.keys(VAULTPASS_SMS_TEMPLATES) as VaultPassSmsTemplateType[]) {
      const envTemplateId = this.config.get<string>(VAULTPASS_SMS_TEMPLATES[type].envKey);
      if (envTemplateId) {
        this.activeTemplateIds[type] = envTemplateId;
        this.templateReady[type] = true;
        this.logger.log(`${VAULTPASS_SMS_TEMPLATES[type].label} 使用模板 ID: ${envTemplateId}`);
      }
    }

    if (this.autoCreate) {
      await this.ensureTemplates();
    }
  }

  isEnabled() {
    return this.enabled;
  }

  async send(notificationType: string, phone: string, message: string) {
    if (!this.enabled || !this.clientConfig) {
      this.logger.log(`[sms:dev] type=${notificationType} to=${this.maskPhone(phone)} message=${message.slice(0, 80)}`);
      return;
    }

    const templateType = resolveTemplateType(notificationType);
    const templateId = this.activeTemplateIds[templateType];

    if (!templateId) {
      throw new Error(`${VAULTPASS_SMS_TEMPLATES[templateType].label} 模板 ID 未配置`);
    }

    if (!this.templateReady[templateType]) {
      throw new Error(`${VAULTPASS_SMS_TEMPLATES[templateType].label} 模板尚未审核通过`);
    }

    const variables = extractSmsVariables(notificationType, message);
    await sendEmayVariableSms(this.clientConfig, {
      phone,
      templateId,
      variables,
      customSmsId: notificationType,
    });
  }

  private async ensureTemplates() {
    if (!this.clientConfig) return;

    for (const type of Object.keys(VAULTPASS_SMS_TEMPLATES) as VaultPassSmsTemplateType[]) {
      if (this.activeTemplateIds[type]) continue;

      try {
        const content = VAULTPASS_SMS_TEMPLATES[type].getContent();
        const templateId = await createEmayTemplate(this.clientConfig, content);
        this.activeTemplateIds[type] = templateId;

        const queried = await queryEmayTemplate(this.clientConfig, templateId);
        this.templateReady[type] = String(queried.status) === '1';
        this.logger.log(
          `${VAULTPASS_SMS_TEMPLATES[type].label} 已提交创建: ${templateId}（状态 ${queried.status ?? '审核中'}）`,
        );
      } catch (error) {
        this.logger.warn(
          `${VAULTPASS_SMS_TEMPLATES[type].label} 自动创建失败: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  async sendLoginOtp(phone: string, code: string) {
    const message = `VaultPass安全验证：您的验证码为${code}，10分钟内有效。如非本人操作请忽略。`;
    await this.send('auth.login.otp', phone, message);
  }

  private maskPhone(phone: string) {
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  }
}
