const INHERITANCE_STAGE_LABELS: Record<string, string> = {
  reminding: '用户提醒期',
  grace_period: '验证宽限期',
  contact_notification: '通知安全联系人',
  cooldown: '冷静期',
  contact_verification_open: '联系人验证开放',
  user_allowed_takeover: '用户允许接管',
  user_cancelled: '用户取消流程',
  user_paused: '用户暂停流程',
};

const INHERITANCE_STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  reminding: '提醒中',
  grace_period: '宽限期',
  contact_verification: '联系人验证',
  cooldown: '冷静期',
  completed: '已完成',
  cancelled: '已取消',
};

export function getInheritanceStageLabel(stage: string): string {
  return INHERITANCE_STAGE_LABELS[stage] ?? stage;
}

export function getInheritanceStatusLabel(status: string): string {
  return INHERITANCE_STATUS_LABELS[status] ?? status;
}
