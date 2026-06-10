const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  'auth.login.otp': '登录验证码',
  'auth.security.alert': '安全告警',
  'contact_takeover.otp': '联系人交接验证码',
  'inheritance.contact.notice': '数字遗产通知',
};

const NOTIFICATION_CHANNEL_LABELS: Record<string, string> = {
  sms: '短信',
  email: '邮件',
};

/** 将通知渠道代码转为中文标签 */
export function getNotificationChannelLabel(channel: string): string {
  return NOTIFICATION_CHANNEL_LABELS[channel] ?? channel;
}

/** 将通知类型代码转为用户可读中文标签 */
export function getNotificationTypeLabel(type: string): string {
  if (NOTIFICATION_TYPE_LABELS[type]) {
    return NOTIFICATION_TYPE_LABELS[type];
  }
  if (type.startsWith('inheritance.')) {
    return '数字遗产通知';
  }
  return type;
}
