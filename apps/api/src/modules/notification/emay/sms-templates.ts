/**
 * VaultPass 亿美软通个性短信模板
 * 变量格式：{#name#}
 * 签名在亿美账号侧配置，模板正文不要写【】签名前缀
 */

export type VaultPassSmsTemplateType = 'otp' | 'inheritance' | 'contactNotice' | 'securityAlert';

export interface SmsTemplateDefinition {
  type: VaultPassSmsTemplateType;
  label: string;
  category: '验证码' | '行业通知';
  envKey: string;
  getContent: () => string;
  buildVariables: (input: { message: string; code?: string; token?: string }) => Record<string, string>;
}

export const VAULTPASS_SMS_TEMPLATES: Record<VaultPassSmsTemplateType, SmsTemplateDefinition> = {
  otp: {
    type: 'otp',
    label: '安全验证码',
    category: '验证码',
    envKey: 'EMAY_TEMPLATE_ID_OTP',
    getContent: () =>
      'VaultPass安全验证：您的验证码为{#code#}，10分钟内有效。如非本人操作请忽略。',
    buildVariables: ({ code }) => ({
      code: code ?? '000000',
    }),
  },
  inheritance: {
    type: 'inheritance',
    label: '数字遗产提醒',
    category: '行业通知',
    envKey: 'EMAY_TEMPLATE_ID_INHERITANCE',
    getContent: () =>
      'VaultPass提醒您：{#message#}。请尽快登录 APP 或小程序确认账户仍在使用。',
    buildVariables: ({ message }) => ({
      message: message.slice(0, 200),
    }),
  },
  contactNotice: {
    type: 'contactNotice',
    label: '安全联系人接管通知',
    category: '行业通知',
    envKey: 'EMAY_TEMPLATE_ID_CONTACT_NOTICE',
    getContent: () =>
      'VaultPass通知：账户持有人长期未活动，数字遗产流程已启动。您的接管令牌为{#token#}，请按指引完成身份验证。',
    buildVariables: ({ token, message }) => ({
      token: token ?? message.slice(0, 64),
    }),
  },
  securityAlert: {
    type: 'securityAlert',
    label: '登录安全告警',
    category: '行业通知',
    envKey: 'EMAY_TEMPLATE_ID_SECURITY_ALERT',
    getContent: () =>
      'VaultPass安全提醒：{#message#}。如非本人操作请立即登录并修改密码、启用二次验证。',
    buildVariables: ({ message }) => ({
      message: message.slice(0, 200),
    }),
  },
};

export function resolveTemplateType(notificationType: string): VaultPassSmsTemplateType {
  if (notificationType === 'auth.login.otp' || notificationType === 'contact_takeover.otp') {
    return 'otp';
  }
  if (notificationType === 'inheritance.contact.notice') {
    return 'contactNotice';
  }
  if (notificationType === 'auth.security.alert') {
    return 'securityAlert';
  }
  if (notificationType.startsWith('inheritance.')) {
    return 'inheritance';
  }
  return 'inheritance';
}

export function extractSmsVariables(
  notificationType: string,
  message: string,
): Record<string, string> {
  const templateType = resolveTemplateType(notificationType);
  const definition = VAULTPASS_SMS_TEMPLATES[templateType];

  if (templateType === 'otp') {
    const code = message.match(/\d{6}/)?.[0];
    return definition.buildVariables({ message, code });
  }

  if (templateType === 'contactNotice') {
    const tokenMatch = message.match(/接管令牌[：:]\s*([^\s，。]+)/);
    return definition.buildVariables({
      message,
      token: tokenMatch?.[1],
    });
  }

  return definition.buildVariables({ message });
}
