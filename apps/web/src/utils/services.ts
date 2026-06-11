import type { PaginatedResponse, UserProfile } from '@vaultpass/types';
import { publicRequest, request, saveToken, vaultSession } from '@/utils/api';

export interface AuthResult {
  accessToken: string;
  user: UserProfile & {
    hasVault?: boolean;
    recoveryKeyConfigured?: boolean;
    recoveryKeyHint?: string;
  };
  encryptedVaultKeyByRecovery?: string;
  vaultKeyBundle?: {
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

export function register(payload: {
  phone?: string;
  email?: string;
  username?: string;
  password?: string;
  encryptedVaultKey?: string;
  kdfSalt?: string;
  kdfParams?: NonNullable<AuthResult['vaultKeyBundle']>['kdfParams'];
  wxCode?: string;
}) {
  return request<AuthResult>({
    url: '/auth/register',
    method: 'POST',
    body: payload,
    auth: false,
  });
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
    body: { pendingId, code },
    auth: false,
  });
}

export function sendLoginCode(phone: string) {
  return request<{ success: boolean }>({
    url: '/auth/send-code',
    method: 'POST',
    body: { phone },
    auth: false,
  });
}

export function loginWithCode(phone: string, code: string) {
  return request<AuthLoginResponse>({
    url: '/auth/login-with-code',
    method: 'POST',
    body: { phone, code },
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
    body: { code },
    auth: false,
  });
}

export function wechatPhoneLogin(code: string) {
  return request<AuthLoginResponse>({
    url: '/auth/wechat-phone-login',
    method: 'POST',
    body: { code },
    auth: false,
  });
}

export function persistAuthResult(result: AuthResult) {
  saveToken(result.accessToken);
  if (result.vaultKeyBundle) {
    vaultSession.setKeyBundle(result.vaultKeyBundle);
  }
  if (result.encryptedVaultKeyByRecovery) {
    vaultSession.setRecoveryBundle(result.encryptedVaultKeyByRecovery);
  }
}

export function createVault(payload: {
  encryptedVaultKey: string;
  encryptedVaultKeyByRecovery: string;
  passwordSalt: string;
  recoverySalt: string;
  kdfParams: NonNullable<AuthResult['vaultKeyBundle']>['kdfParams'];
}) {
  return request<{ created: boolean; hasVault: boolean }>({
    url: '/vault/create',
    method: 'POST',
    body: payload,
  });
}

export function sendEmailLoginCode(email: string) {
  return request<{ success: boolean }>({
    url: '/auth/send-email-code',
    method: 'POST',
    body: { email },
    auth: false,
  });
}

export function loginWithEmailCode(email: string, code: string) {
  return request<AuthLoginResponse>({
    url: '/auth/login-with-email-code',
    method: 'POST',
    body: { email, code },
    auth: false,
  });
}

export function loginWithPassword(username: string, password: string) {
  return request<AuthLoginResponse>({
    url: '/auth/login-with-password',
    method: 'POST',
    body: { username, password },
    auth: false,
  });
}

export function heartbeat() {
  return request<{ lastLoginAt?: string }>({ url: '/users/me/heartbeat', method: 'POST' });
}

export interface ExtendedUserProfile extends UserProfile {
  mfaEnabled: boolean;
  recoveryKeyConfigured?: boolean;
  recoveryKeyHint?: string;
  encryptedVaultKeyByRecovery?: string;
  wxBound?: boolean;
}

export function createScanLoginSession() {
  return request<{
    scanId: string;
    qrImageBase64?: string;
    expiresAt: string;
  }>({
    url: '/auth/scan/create',
    method: 'POST',
    auth: false,
  });
}

export function getScanLoginStatus(scanId: string) {
  return request<
    | { status: 'pending' | 'expired' | 'mfa_required' }
    | ({ status: 'confirmed' } & AuthResult)
  >({
    url: `/auth/scan/${scanId}/status`,
    auth: false,
  });
}

export function verifyScanLoginMfa(scanId: string, code: string) {
  return request<{ status: 'confirmed' } & AuthResult>({
    url: `/auth/scan/${scanId}/verify-mfa`,
    method: 'POST',
    body: { code },
    auth: false,
  });
}

export function bindWechat(code: string) {
  return request<{ bound: boolean }>({
    url: '/auth/me/wechat/bind',
    method: 'POST',
    body: { code },
  });
}

export function unbindWechat() {
  return request<{ bound: boolean }>({
    url: '/auth/me/wechat/unbind',
    method: 'POST',
  });
}

export function createWxBindScanSession() {
  return request<{
    bindId: string;
    qrImageBase64?: string;
    expiresAt: string;
  }>({
    url: '/auth/wx-bind/scan/create',
    method: 'POST',
  });
}

export function getWxBindScanStatus(bindId: string) {
  return request<{ status: 'pending' | 'confirmed' | 'expired' }>({
    url: `/auth/wx-bind/scan/${bindId}/status`,
  });
}

export interface NotificationLogItem {
  id: string;
  channel: string;
  notificationType: string;
  target?: string;
  status: string;
  createdAt: string;
}

export function listNotifications(page = 1) {
  return request<PaginatedResponse<NotificationLogItem> & { page: number; pageSize: number }>({
    url: '/notifications',
    query: { page, pageSize: 10 },
  });
}

export function getProfile() {
  return request<ExtendedUserProfile>({ url: '/users/me' });
}

export function updateProfile(payload: { phone?: string; email?: string }) {
  return request<ExtendedUserProfile>({ url: '/users/me', method: 'PATCH', body: payload });
}

export function setupMfa() {
  return request<{ secret: string; otpauthUrl: string }>({
    url: '/users/me/mfa/setup',
    method: 'POST',
  });
}

export function enableMfa(secret: string, code: string) {
  return request({ url: '/users/me/mfa/enable', method: 'POST', body: { secret, code } });
}

export function disableMfa(code: string) {
  return request({ url: '/users/me/mfa/disable', method: 'POST', body: { code } });
}

export function verifyMfa(code: string) {
  return request<{ verified: boolean }>({ url: '/users/me/mfa/verify', method: 'POST', body: { code } });
}

export function logDataExport(mfaCode?: string) {
  return request<{ logged: boolean }>({
    url: '/users/me/export/audit',
    method: 'POST',
    mfaCode,
  });
}

export function setupRecoveryKey(payload: {
  encryptedVaultKeyByRecovery: string;
  recoveryKeyHint?: string;
}, mfaCode?: string) {
  return request<{ configured: boolean }>({
    url: '/users/me/recovery-key',
    method: 'PUT',
    body: payload,
    mfaCode,
  });
}

export interface LoginDeviceItem {
  id: string;
  deviceId: string;
  deviceName?: string;
  ip?: string;
  lastActiveAt: string;
  createdAt: string;
}

export function listLoginDevices() {
  return request<{ items: LoginDeviceItem[] }>({ url: '/users/me/devices' });
}

export function revokeLoginDevice(id: string) {
  return request<{ id: string; revoked: boolean }>({
    url: `/users/me/devices/${id}`,
    method: 'DELETE',
  });
}

export interface VaultItem {
  id: string;
  type: string;
  titleCiphertext: string;
  encryptedPayload: string;
  favorite: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listVaultItems(type?: string, page = 1) {
  return request<PaginatedResponse<VaultItem> & { page: number; pageSize: number }>({
    url: '/vault/items',
    query: { type, page, pageSize: 100 },
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
  return request<VaultItem>({ url: '/vault/items', method: 'POST', body: payload });
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
  return request<VaultItem>({ url: `/vault/items/${id}`, method: 'PATCH', body: payload });
}

export function deleteVaultItem(id: string) {
  return request({ url: `/vault/items/${id}`, method: 'DELETE' });
}

export function listTrashVaultItems(type?: string, page = 1) {
  return request<PaginatedResponse<VaultItem> & { page: number; pageSize: number }>({
    url: '/vault/items/trash',
    query: { type, page, pageSize: 100 },
  });
}

export function restoreVaultItem(id: string) {
  return request<VaultItem>({ url: `/vault/items/${id}/restore`, method: 'POST' });
}

export function permanentDeleteVaultItem(id: string, mfaCode?: string) {
  return request({ url: `/vault/items/${id}/permanent`, method: 'DELETE', mfaCode });
}

export function revealVaultPassword(id: string, mfaCode?: string) {
  return request<{ verified: boolean }>({
    url: `/vault/items/${id}/reveal`,
    method: 'POST',
    mfaCode,
  });
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
  return request<AlbumItem>({ url: '/albums', method: 'POST', body: payload });
}

export function updateAlbum(
  id: string,
  payload: {
    encryptedName?: string;
    encryptedDescription?: string;
    encryptedCoverFileId?: string;
  },
) {
  return request<AlbumItem>({ url: `/albums/${id}`, method: 'PATCH', body: payload });
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
    query: albumId ? { albumId } : {},
  });
}

export function deleteFile(id: string) {
  return request({ url: `/files/${id}`, method: 'DELETE' });
}

export function updateFile(id: string, payload: { encryptedMetadata?: string }) {
  return request<VaultFileItem>({ url: `/files/${id}`, method: 'PATCH', body: payload });
}

export interface TrustedContactItem {
  id: string;
  permissionScope: string;
  priority: number;
  status: string;
  nameCiphertext: string;
  phoneCiphertext: string;
  emailCiphertext: string;
}

export function listTrustedContacts() {
  return request<PaginatedResponse<TrustedContactItem> & { page: number; pageSize: number }>({
    url: '/trusted-contacts',
  });
}

export function createTrustedContact(payload: Record<string, unknown>, mfaCode?: string) {
  return request({ url: '/trusted-contacts', method: 'POST', body: payload, mfaCode });
}

export function addContactChallenge(
  payload: {
    contactId: string;
    encryptedQuestion: string;
    encryptedAnswerHash: string;
    questionLabel?: string;
  },
  mfaCode?: string,
) {
  return request({
    url: '/trusted-contacts/challenges',
    method: 'POST',
    body: payload,
    mfaCode,
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
  return request<InheritanceRuleItem | null>({ url: '/inheritance/rule' });
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
    body: payload,
    mfaCode,
  });
}

export function disableInheritanceRule(mfaCode?: string) {
  return request({ url: '/inheritance/rule/disable', method: 'POST', mfaCode });
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

export function respondInheritanceEvent(id: string, action: 'cancel' | 'pause' | 'allow_takeover') {
  return request({
    url: `/inheritance/events/${id}/respond`,
    method: 'POST',
    body: { action },
  });
}

export function listInheritanceEvents(page = 1) {
  return request<PaginatedResponse<InheritanceEventItem> & { page: number; pageSize: number }>({
    url: '/inheritance/events',
    query: { page, pageSize: 20 },
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

export function listAuditLogs(page = 1) {
  return request<PaginatedResponse<AuditLogItem> & { page: number; pageSize: number }>({
    url: '/audit-logs',
    query: { page, pageSize: 50 },
  });
}

export function startContactTakeover(token: string) {
  return publicRequest<{ sessionId: string; permissionScope: string }>({
    url: '/contact-takeover/start',
    method: 'POST',
    body: { token },
    auth: false,
  });
}

export function sendContactTakeoverOtp(
  sessionId: string,
  payload: { channel: 'sms' | 'email'; target: string },
) {
  return publicRequest({
    url: `/contact-takeover/${sessionId}/send-otp`,
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function verifyContactTakeoverOtp(sessionId: string, code: string) {
  return publicRequest({
    url: `/contact-takeover/${sessionId}/verify-otp`,
    method: 'POST',
    body: { code },
    auth: false,
  });
}

export function listContactTakeoverChallenges(sessionId: string) {
  return publicRequest<{ items: Array<{ id: string; questionLabel: string }> }>({
    url: `/contact-takeover/${sessionId}/challenges`,
    auth: false,
  });
}

export function verifyContactTakeoverChallenges(
  sessionId: string,
  answers: Array<{ challengeId: string; answer: string }>,
) {
  return publicRequest({
    url: `/contact-takeover/${sessionId}/verify-challenges`,
    method: 'POST',
    body: { answers },
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
  return publicRequest<ContactTakeoverCompleteResult>({
    url: `/contact-takeover/${sessionId}/complete`,
    method: 'POST',
    auth: false,
  });
}

export function listContactVaultItems(sessionId: string, type?: string) {
  return publicRequest<{
    items: VaultItem[];
    permissionScope: string;
  }>({
    url: `/contact-takeover/${sessionId}/vault/items`,
    query: type ? { type } : {},
    auth: false,
  });
}

export function listContactVaultFiles(sessionId: string) {
  return publicRequest<{
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
