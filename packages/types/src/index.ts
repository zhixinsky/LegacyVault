/** 用户状态 */
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

/** 保险箱条目类型 */
export type VaultItemType =
  | 'password'
  | 'stock_account'
  | 'bank_account'
  | 'email_account'
  | 'server_account'
  | 'note'
  | 'document'
  | 'custom';

/** 安全联系人权限范围 */
export type ContactPermissionScope =
  | 'notify_only'
  | 'request_takeover'
  | 'view_partial'
  | 'view_all'
  | 'export'
  | 'inactive_only';

/** 审计日志操作者类型 */
export type AuditActorType = 'user' | 'contact' | 'system' | 'admin';

/** 审计日志风险等级 */
export type AuditRiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** 数字遗产事件状态 */
export type InheritanceEventStatus =
  | 'pending'
  | 'reminding'
  | 'grace_period'
  | 'contact_verification'
  | 'cooldown'
  | 'completed'
  | 'cancelled';

/** API 统一响应结构 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/** 分页请求参数 */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 用户基础信息（不含敏感字段） */
export interface UserProfile {
  id: string;
  username?: string;
  phone?: string;
  email?: string;
  status: UserStatus;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

/** 加密密钥包（服务器存储形态） */
export interface EncryptedVaultKeyBundle {
  encryptedVaultKey: string;
  kdfSalt: string;
  kdfParams: KdfParams;
}

/** KDF 参数 */
export interface KdfParams {
  algorithm: 'argon2id';
  memory: number;
  iterations: number;
  parallelism: number;
}

/** 保险箱条目（服务器存储形态，均为密文） */
export interface VaultItemRecord {
  id: string;
  userId: string;
  type: VaultItemType;
  titleCiphertext: string;
  encryptedPayload: string;
  encryptedMetadata?: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 安全联系人记录 */
export interface TrustedContactRecord {
  id: string;
  userId: string;
  permissionScope: ContactPermissionScope;
  priority: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
}

export * from './vault-item-schemas';
export * from './audit-actions';
export * from './media';
export * from './notification-labels';
export * from './file-metadata';
export * from './inheritance-labels';

/** 数字遗产规则 */
export interface InheritanceRule {  id: string;
  userId: string;
  inactiveYears: number;
  reminderFrequency: 'monthly' | 'bimonthly' | 'quarterly';
  gracePeriodMonths: number;
  requireMultiContact: boolean;
  status: 'active' | 'inactive';
}
