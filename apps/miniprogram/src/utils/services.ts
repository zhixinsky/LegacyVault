import type { PaginatedResponse, UserProfile } from '@vaultpass/types';
import { request, saveToken, vaultSession } from './api';

export interface AuthResult {
  accessToken: string;
  user: UserProfile & {
    recoveryKeyConfigured?: boolean;
    recoveryKeyHint?: string;
  };
  encryptedVaultKeyByRecovery?: string;
  vaultKeyBundle: {
    encryptedVaultKey: string;
    kdfSalt: string;
    kdfParams: {
      algorithm: 'argon2id';
      memory: number;
      iterations: number;
      parallelism: number;
    };
  };
}

export type AuthLoginResponse =
  | AuthResult
  | { registered: false; phone?: string; email?: string; username?: string }
  | { mfaRequired: true; pendingId: string };

export function isAuthResult(value: AuthLoginResponse): value is AuthResult {
  return 'accessToken' in value;
}

export function isMfaRequired(
  value: AuthLoginResponse,
): value is { mfaRequired: true; pendingId: string } {
  return 'mfaRequired' in value && value.mfaRequired === true;
}

export function loginMfa(pendingId: string, code: string) {
  return request<AuthResult>({
    url: '/auth/login-mfa',
    method: 'POST',
    data: { pendingId, code },
    auth: false,
  });
}

export interface RegisterPayload {
  phone?: string;
  email?: string;
  username?: string;
  password?: string;
  encryptedVaultKey: string;
  kdfSalt: string;
  kdfParams: AuthResult['vaultKeyBundle']['kdfParams'];
  wxCode?: string;
}

export function register(payload: RegisterPayload) {
  return request<AuthResult>({
    url: '/auth/register',
    method: 'POST',
    data: payload,
    auth: false,
  });
}

export function sendLoginCode(phone: string) {
  return request<{ success: boolean }>({
    url: '/auth/send-code',
    method: 'POST',
    data: { phone },
    auth: false,
  });
}

export function loginWithCode(phone: string, code: string) {
  return request<AuthLoginResponse>({
    url: '/auth/login-with-code',
    method: 'POST',
    data: { phone, code },
    auth: false,
  });
}

export function sendEmailLoginCode(email: string) {
  return request<{ success: boolean }>({
    url: '/auth/send-email-code',
    method: 'POST',
    data: { email },
    auth: false,
  });
}

export function loginWithEmailCode(email: string, code: string) {
  return request<AuthLoginResponse>({
    url: '/auth/login-with-email-code',
    method: 'POST',
    data: { email, code },
    auth: false,
  });
}

export function loginWithPassword(username: string, password: string) {
  return request<AuthLoginResponse>({
    url: '/auth/login-with-password',
    method: 'POST',
    data: { username, password },
    auth: false,
  });
}

export function login(phone: string, code: string) {
  return loginWithCode(phone, code);
}

export function wxLogin(code: string) {
  return request<AuthLoginResponse>({
    url: '/auth/wx-login',
    method: 'POST',
    data: { code },
    auth: false,
  });
}

export function wechatPhoneLogin(code: string) {
  return request<AuthLoginResponse>({
    url: '/auth/wechat-phone-login',
    method: 'POST',
    data: { code },
    auth: false,
  });
}

export function persistAuthResult(result: AuthResult) {
  saveToken(result.accessToken);
  vaultSession.setKeyBundle(result.vaultKeyBundle);
  if (result.encryptedVaultKeyByRecovery) {
    vaultSession.setRecoveryBundle(result.encryptedVaultKeyByRecovery);
  }
}

export function heartbeat() {
  return request<{ lastLoginAt?: string }>({
    url: '/users/me/heartbeat',
    method: 'POST',
  });
}

export function getCloudFileUrl(fileId: string, maxAge = 600) {
  return request<{ url: string; expiresIn: number }>({
    url: `/files/cloud-url?fileId=${encodeURIComponent(fileId)}&maxAge=${maxAge}`,
    auth: false,
  });
}

export interface VaultItem {
  id: string;
  type: string;
  titleCiphertext: string;
  encryptedPayload: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export function listVaultItems(type?: string, page = 1) {
  return request<PaginatedResponse<VaultItem> & { page: number; pageSize: number }>({
    url: '/vault/items',
    data: { type, page, pageSize: 50 },
  });
}

export function getVaultItem(id: string) {
  return request<VaultItem>({ url: `/vault/items/${id}` });
}

export function createVaultItem(payload: {
  type: string;
  titleCiphertext: string;
  encryptedPayload: string;
}) {
  return request<VaultItem>({
    url: '/vault/items',
    method: 'POST',
    data: payload,
  });
}

export function updateVaultItem(
  id: string,
  payload: {
    titleCiphertext?: string;
    encryptedPayload?: string;
    encryptedMetadata?: string;
    favorite?: boolean;
  },
) {
  return request<VaultItem>({ url: `/vault/items/${id}`, method: 'PATCH', data: payload });
}

export function deleteVaultItem(id: string) {
  return request({ url: `/vault/items/${id}`, method: 'DELETE' });
}

export function listTrashVaultItems(type?: string) {
  return request<PaginatedResponse<VaultItem>>({
    url: '/vault/items/trash',
    data: type ? { type } : {},
  });
}

export function restoreVaultItem(id: string) {
  return request<VaultItem>({ url: `/vault/items/${id}/restore`, method: 'POST' });
}

export function permanentDeleteVaultItem(id: string, mfaCode?: string) {
  return request({ url: `/vault/items/${id}/permanent`, method: 'DELETE', mfaCode });
}

export interface AlbumItem {
  id: string;
  encryptedName: string;
  encryptedDescription?: string;
  encryptedCoverFileId?: string | null;
  createdAt: string;
  _count?: { files: number };
}

export function listAlbums() {
  return request<PaginatedResponse<AlbumItem> & { page: number; pageSize: number }>({
    url: '/albums',
  });
}

export function createAlbum(payload: {
  encryptedName: string;
  encryptedDescription?: string;
  encryptedCoverFileId?: string;
}) {
  return request<AlbumItem>({
    url: '/albums',
    method: 'POST',
    data: payload,
  });
}

export function updateAlbum(
  id: string,
  payload: {
    encryptedName?: string;
    encryptedDescription?: string;
    encryptedCoverFileId?: string;
  },
) {
  return request<AlbumItem>({
    url: `/albums/${id}`,
    method: 'PATCH',
    data: payload,
  });
}

export interface VaultFileItem {
  id: string;
  albumId?: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  encryptedFileKey: string;
  encryptedMetadata?: string | null;
  createdAt: string;
}

export function listFiles(albumId?: string) {
  return request<PaginatedResponse<VaultFileItem> & { page: number; pageSize: number }>({
    url: '/files',
    data: albumId ? { albumId } : {},
  });
}

export function updateFile(id: string, payload: { encryptedMetadata?: string }) {
  return request<VaultFileItem>({
    url: `/files/${id}`,
    method: 'PATCH',
    data: payload,
  });
}

export function deleteFile(id: string) {
  return request({ url: `/files/${id}`, method: 'DELETE' });
}

export function revealVaultPassword(id: string, mfaCode?: string) {
  return request<{ verified: boolean }>({
    url: `/vault/items/${id}/reveal`,
    method: 'POST',
    mfaCode,
  });
}

export interface ExtendedUserProfile extends UserProfile {
  mfaEnabled: boolean;
  recoveryKeyConfigured?: boolean;
  recoveryKeyHint?: string;
  encryptedVaultKeyByRecovery?: string;
  wxBound?: boolean;
}

export interface TrustedContactItem {
  id: string;
  permissionScope: string;
  priority: number;
  status: string;
  nameCiphertext: string;
  phoneCiphertext?: string;
  emailCiphertext?: string;
}

export function listTrustedContacts() {
  return request<PaginatedResponse<TrustedContactItem> & { page: number; pageSize: number }>({
    url: '/trusted-contacts',
  });
}

export function createTrustedContact(payload: Record<string, unknown>, mfaCode?: string) {
  return request<{ id: string }>({
    url: '/trusted-contacts',
    method: 'POST',
    data: payload,
    mfaCode,
  });
}

export function addContactChallenge(payload: {
  contactId: string;
  encryptedQuestion: string;
  encryptedAnswerHash: string;
  questionLabel?: string;
}) {
  return request({
    url: '/trusted-contacts/challenges',
    method: 'POST',
    data: payload,
  });
}

export interface InheritanceRuleItem {
  id: string;
  inactiveYears: number;
  reminderFrequency: string;
  gracePeriodMonths: number;
  requireMultiContact: boolean;
  status: string;
}

export function getInheritanceRule() {
  return request<InheritanceRuleItem | null>({
    url: '/inheritance/rule',
  });
}

export function saveInheritanceRule(
  payload: {
    inactiveYears: number;
    reminderFrequency: string;
    gracePeriodMonths: number;
    requireMultiContact?: boolean;
    status?: string;
  },
  mfaCode?: string,
) {
  return request<InheritanceRuleItem>({
    url: '/inheritance/rule',
    method: 'PUT',
    data: payload,
    mfaCode,
  });
}

export function disableInheritanceRule(mfaCode?: string) {
  return request({ url: '/inheritance/rule/disable', method: 'POST', mfaCode });
}

export function getProfile() {
  return request<ExtendedUserProfile>({ url: '/users/me' });
}

export function updateProfile(payload: { phone?: string; email?: string }) {
  return request<ExtendedUserProfile>({ url: '/users/me', method: 'PATCH', data: payload });
}

export function approveScanLogin(scanId: string) {
  return request<{ success: boolean }>({
    url: `/auth/scan/${scanId}/approve`,
    method: 'POST',
  });
}

export function confirmScanLogin(scanId: string, code: string) {
  return request<{ success: boolean }>({
    url: `/auth/scan/${scanId}/confirm`,
    method: 'POST',
    data: { code },
    auth: false,
  });
}

export function bindWechat(code: string) {
  return request<{ bound: boolean }>({
    url: '/auth/me/wechat/bind',
    method: 'POST',
    data: { code },
  });
}

export function unbindWechat() {
  return request<{ bound: boolean }>({
    url: '/auth/me/wechat/unbind',
    method: 'POST',
  });
}

export function setupRecoveryKey(
  payload: { encryptedVaultKeyByRecovery: string; recoveryKeyHint?: string },
  mfaCode?: string,
) {
  return request<{ configured: boolean }>({
    url: '/users/me/recovery-key',
    method: 'PUT',
    data: payload,
    mfaCode,
  });
}

export function listLoginDevices() {
  return request<{
    items: Array<{
      id: string;
      deviceName?: string;
      ip?: string;
      lastActiveAt: string;
    }>;
  }>({ url: '/users/me/devices' });
}

export function revokeLoginDevice(id: string) {
  return request({ url: `/users/me/devices/${id}`, method: 'DELETE' });
}

export function setupMfa() {
  return request<{ secret: string; otpauthUrl: string }>({
    url: '/users/me/mfa/setup',
    method: 'POST',
  });
}

export function enableMfa(secret: string, code: string) {
  return request({ url: '/users/me/mfa/enable', method: 'POST', data: { secret, code } });
}

export function disableMfa(code: string) {
  return request({ url: '/users/me/mfa/disable', method: 'POST', data: { code } });
}

export function verifyMfa(code: string) {
  return request<{ verified: boolean }>({
    url: '/users/me/mfa/verify',
    method: 'POST',
    data: { code },
  });
}

export function logDataExport(mfaCode?: string) {
  return request<{ logged: boolean }>({
    url: '/users/me/export/audit',
    method: 'POST',
    mfaCode,
  });
}

export function listContactVaultFiles(sessionId: string) {
  return request<{
    items: Array<{
      id: string;
      fileType: string;
      fileSize: number;
      mimeType: string;
      encryptedFileKey: string;
    }>;
    permissionScope: string;
  }>({
    url: `/contact-takeover/${sessionId}/vault/files`,
    auth: false,
  });
}

export interface InheritanceEventItem {
  id: string;
  status: string;
  currentStage: string;
  triggerAt: string;
  graceEndsAt?: string;
  cooldownEndsAt?: string;
  createdAt: string;
}

export function getActiveInheritanceEvent() {
  return request<InheritanceEventItem | null>({
    url: '/inheritance/events/active',
  });
}

export function listInheritanceEvents(page = 1) {
  return request<PaginatedResponse<InheritanceEventItem> & { page: number; pageSize: number }>({
    url: '/inheritance/events',
    data: { page, pageSize: 20 },
  });
}

export function respondInheritanceEvent(id: string, action: 'cancel' | 'pause' | 'allow_takeover') {
  return request({
    url: `/inheritance/events/${id}/respond`,
    method: 'POST',
    data: { action },
  });
}

export interface AuditLogItem {
  id: string;
  action: string;
  riskLevel: string;
  ip?: string;
  device?: string;
  createdAt: string;
}

export function listNotifications(page = 1) {
  return request<{
    items: Array<{
      id: string;
      channel: string;
      notificationType: string;
      status: string;
      createdAt: string;
    }>;
  }>({
    url: '/notifications',
    data: { page, pageSize: 10 },
  });
}

export function confirmWxBindScan(bindId: string, code: string) {
  return request<{ success: boolean }>({
    url: `/auth/wx-bind/scan/${bindId}/confirm`,
    method: 'POST',
    data: { code },
    auth: false,
  });
}

export function listAuditLogs(page = 1) {
  return request<PaginatedResponse<AuditLogItem> & { page: number; pageSize: number }>({
    url: '/audit-logs',
    data: { page, pageSize: 20 },
  });
}

export function startContactTakeover(token: string) {
  return request<{ sessionId: string }>({
    url: '/contact-takeover/start',
    method: 'POST',
    data: { token },
    auth: false,
  });
}

export function sendContactTakeoverOtp(
  sessionId: string,
  payload: { channel: 'sms' | 'email'; target: string },
) {
  return request({
    url: `/contact-takeover/${sessionId}/send-otp`,
    method: 'POST',
    data: payload,
    auth: false,
  });
}

export function verifyContactTakeoverOtp(sessionId: string, code: string) {
  return request({
    url: `/contact-takeover/${sessionId}/verify-otp`,
    method: 'POST',
    data: { code },
    auth: false,
  });
}

export function listContactTakeoverChallenges(sessionId: string) {
  return request<{ items: Array<{ id: string; questionLabel: string }> }>({
    url: `/contact-takeover/${sessionId}/challenges`,
    auth: false,
  });
}

export function verifyContactTakeoverChallenges(
  sessionId: string,
  answers: Array<{ challengeId: string; answer: string }>,
) {
  return request({
    url: `/contact-takeover/${sessionId}/verify-challenges`,
    method: 'POST',
    data: { answers },
    auth: false,
  });
}

export interface ContactTakeoverCompleteResult {
  encryptedVaultKeyForContact?: string;
  permissionScope?: string;
  pendingMultiContact?: boolean;
  completedCount?: number;
  requiredCount?: number;
}

export function completeContactTakeover(sessionId: string) {
  return request<ContactTakeoverCompleteResult>({
    url: `/contact-takeover/${sessionId}/complete`,
    method: 'POST',
    auth: false,
  });
}

export function listContactVaultItems(sessionId: string, type?: string) {
  return request<{ items: VaultItem[]; permissionScope: string }>({
    url: `/contact-takeover/${sessionId}/vault/items`,
    data: type ? { type } : {},
    auth: false,
  });
}

export function uploadEncryptedFile(options: {
  filePath: string;
  formData: Record<string, string | number>;
}) {
  const token = uni.getStorageSync('vp_access_token') as string;

  return new Promise<VaultFileItem>((resolve, reject) => {
    uni.uploadFile({
      url: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'}/files/upload`,
      filePath: options.filePath,
      name: 'file',
      formData: options.formData as UniApp.UploadFileOption['formData'],
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const body = JSON.parse(res.data) as { code: number; message: string; data: VaultFileItem };
          if (body.code === 0) {
            resolve(body.data);
            return;
          }
          reject(new Error(body.message));
        } catch {
          reject(new Error('上传响应解析失败'));
        }
      },
      fail: (error) => reject(new Error(error.errMsg || '上传失败')),
    });
  });
}
