export const LOGIN_AUDIT_ACTIONS = [
  'auth.login',
  'auth.login.sms',
  'auth.login.wx',
  'auth.login.wechat_phone',
  'auth.login.scan',
  'auth.login.failed',
  'auth.new_device',
  'auth.login.new_ip',
  'auth.login.blocked_ip',
] as const;

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'auth.login': '密码/验证码登录',
  'auth.login.sms': '短信验证码登录',
  'auth.login.wx': '微信登录',
  'auth.login.wechat_phone': '微信手机号快捷登录',
  'auth.login.scan': '扫码登录',
  'auth.login.failed': '登录失败',
  'auth.new_device': '新设备登录',
  'auth.login.new_ip': '异地登录（IP 变更）',
  'auth.login.blocked_ip': '黑名单 IP 拦截登录',
  'auth.device.revoke': '移除登录设备',
  'auth.register': '注册账号',
  'vault.item.create': '创建保险箱条目',
  'vault.item.delete': '删除保险箱条目',
  'vault.item.restore': '恢复保险箱条目',
  'vault.password.reveal': '查看敏感信息',
  'vault.item.permanent_delete': '永久删除条目',
  'user.wechat.bind': '绑定微信',
  'user.wechat.unbind': '解绑微信',
  'user.profile.update': '更新个人资料',
  'file.upload': '上传加密文件',
  'file.download': '下载加密文件',
  'file.delete': '删除文件',
  'file.update': '更新文件信息',
  'album.create': '创建相册',
  'album.update': '更新相册',
  'album.delete': '删除相册',
  'user.mfa.enable': '启用二次验证',
  'user.mfa.disable': '关闭二次验证',
  'user.recovery_key.setup': '设置恢复密钥',
  'export.data': '数据导出',
};

export function getAuditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function isLoginAuditAction(action: string) {
  return (LOGIN_AUDIT_ACTIONS as readonly string[]).includes(action);
}
