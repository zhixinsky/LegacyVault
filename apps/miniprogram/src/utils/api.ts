import type { EncryptedVaultKeyBundle, KdfParams } from '@vaultpass/types';
import { zeroize } from '@vaultpass/crypto';
import {
  API_BASE_URL,
  DEVICE_ID_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
  USE_WX_CLOUD_CONTAINER,
  WX_CLOUD_ENV_ID,
  WX_CLOUD_SERVICE,
} from '../config';

const KEY_BUNDLE_STORAGE_KEY = 'vp_key_bundle';
const RECOVERY_BUNDLE_STORAGE_KEY = 'vp_recovery_bundle';
const RECOVERY_SALT_STORAGE_KEY = 'vp_recovery_salt';

export function getDeviceId() {
  let deviceId = uni.getStorageSync(DEVICE_ID_STORAGE_KEY) as string;
  if (!deviceId) {
    deviceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    uni.setStorageSync(DEVICE_ID_STORAGE_KEY, deviceId);
  }
  return deviceId;
}

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

type RequestHeader = Record<string, string>;

interface WxCloudApi {
  init(options: { env: string; traceUser?: boolean }): void;
  callContainer<T = unknown>(options: {
    config: { env: string };
    path: string;
    method: string;
    data?: unknown;
    header?: RequestHeader;
    success: (res: { statusCode?: number; data: T }) => void;
    fail: (error: { errMsg?: string }) => void;
  }): void;
}

export interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: Record<string, unknown> | unknown;
  auth?: boolean;
  mfaCode?: string;
}

let wxCloudInitialized = false;

function getWxCloud(): WxCloudApi | undefined {
  if (!USE_WX_CLOUD_CONTAINER) {
    return undefined;
  }

  const wxRuntime = (globalThis as typeof globalThis & { wx?: { cloud?: WxCloudApi } }).wx;
  return wxRuntime?.cloud;
}

function buildHeaders(token: string, options: RequestOptions): RequestHeader {
  return {
    'Content-Type': 'application/json',
    'X-Device-Id': getDeviceId(),
    ...(options.auth !== false && token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.mfaCode ? { 'X-Mfa-Code': options.mfaCode } : {}),
  };
}

function isGetRequest(options: RequestOptions) {
  return (options.method ?? 'GET') === 'GET';
}

function appendQuery(url: string, data: RequestOptions['data']) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return url;
  }

  const [path, query = ''] = url.split('?');
  const params = new Map<string, string>();
  query
    .split('&')
    .filter(Boolean)
    .forEach((pair) => {
      const [key, value = ''] = pair.split('=');
      if (key) {
        params.set(decodeURIComponent(key), decodeURIComponent(value));
      }
    });

  Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });

  const queryString = Array.from(params.entries())
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return queryString ? `${path}?${queryString}` : path;
}

function buildRequestUrl(options: RequestOptions) {
  return isGetRequest(options) ? appendQuery(options.url, options.data) : options.url;
}

function buildRequestData(options: RequestOptions) {
  return isGetRequest(options) ? undefined : options.data;
}

function extractErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const body = data as {
    message?: string | string[];
    error?: string;
  };
  if (Array.isArray(body.message)) {
    return body.message.join('；') || fallback;
  }
  return body.message || body.error || fallback;
}

function unwrapResponse<T>(statusCode: number | undefined, data: unknown): T {
  if ((statusCode ?? 200) >= 400) {
    throw new Error(extractErrorMessage(data, `请求失败 (${statusCode})`));
  }

  const body = data as ApiEnvelope<T>;
  if (body && typeof body === 'object' && 'code' in body) {
    if (body.code === 0) {
      return body.data;
    }
    throw new Error(body.message || '请求失败');
  }

  return data as T;
}

function callCloudContainer<T>(options: RequestOptions, token: string): Promise<T> | undefined {
  const cloud = getWxCloud();
  if (!cloud) {
    return undefined;
  }
  if (!WX_CLOUD_ENV_ID || !WX_CLOUD_SERVICE) {
    return Promise.reject(new Error('未配置微信云托管环境或服务名'));
  }

  if (!wxCloudInitialized) {
    cloud.init({ env: WX_CLOUD_ENV_ID, traceUser: true });
    wxCloudInitialized = true;
  }

  return new Promise((resolve, reject) => {
    const requestUrl = buildRequestUrl(options);
    cloud.callContainer({
      config: { env: WX_CLOUD_ENV_ID },
      path: `/api/v1${requestUrl}`,
      method: options.method ?? 'GET',
      data: buildRequestData(options),
      header: {
        ...buildHeaders(token, options),
        'X-WX-SERVICE': WX_CLOUD_SERVICE,
      },
      success: (res) => {
        try {
          resolve(unwrapResponse<T>(res.statusCode, res.data));
        } catch (error) {
          reject(error);
        }
      },
      fail: (error) => reject(new Error(error.errMsg || '网络错误')),
    });
  });
}

export async function request<T>(options: RequestOptions): Promise<T> {
  const token = uni.getStorageSync(TOKEN_STORAGE_KEY) as string;
  const cloudRequest = callCloudContainer<T>(options, token);
  if (cloudRequest) {
    return cloudRequest;
  }

  return new Promise((resolve, reject) => {
    const requestUrl = buildRequestUrl(options);
    uni.request({
      url: `${API_BASE_URL}${requestUrl}`,
      method: (options.method ?? 'GET') as UniApp.RequestOptions['method'],
      data: buildRequestData(options) as UniApp.RequestOptions['data'],
      header: buildHeaders(token, options),
      success: (res) => {
        try {
          resolve(unwrapResponse<T>(res.statusCode, res.data));
        } catch (error) {
          reject(error);
        }
      },
      fail: (error) => reject(new Error(error.errMsg || '网络错误')),
    });
  });
}

export function saveToken(token: string) {
  uni.setStorageSync(TOKEN_STORAGE_KEY, token);
}

export function getToken() {
  return uni.getStorageSync(TOKEN_STORAGE_KEY) as string;
}

export function clearToken() {
  uni.removeStorageSync(TOKEN_STORAGE_KEY);
  uni.removeStorageSync(KEY_BUNDLE_STORAGE_KEY);
  uni.removeStorageSync(RECOVERY_BUNDLE_STORAGE_KEY);
  uni.removeStorageSync(RECOVERY_SALT_STORAGE_KEY);
}

/** vault_key 仅保存在内存，禁止写入 localStorage */
let vaultKeyMemory: Uint8Array | null = null;
let keyBundleMemory: EncryptedVaultKeyBundle | null = null;
let recoveryBundleMemory: string | null = null;
let recoverySaltMemory: string | null = null;
let pendingVaultSetup:
  | {
      recoveryKey: string;
      recoveryLastGroup: string;
    }
  | null = null;
let pendingPhone = '';
let pendingEmail = '';
let pendingUsername = '';
let pendingPassword = '';
let pendingWxCode = '';

export const vaultSession = {
  setVaultKey(key: Uint8Array) {
    vaultSession.clearVaultKey();
    vaultKeyMemory = key;
  },

  getVaultKey() {
    return vaultKeyMemory;
  },

  requireVaultKey() {
    if (!vaultKeyMemory) {
      throw new Error('保险箱未解锁，请先输入主密码');
    }
    return vaultKeyMemory;
  },

  clearVaultKey() {
    if (vaultKeyMemory) {
      zeroize(vaultKeyMemory);
      vaultKeyMemory = null;
    }
  },

  setKeyBundle(bundle: EncryptedVaultKeyBundle) {
    keyBundleMemory = bundle;
    uni.setStorageSync(KEY_BUNDLE_STORAGE_KEY, JSON.stringify(bundle));
  },

  getKeyBundle() {
    if (keyBundleMemory) {
      return keyBundleMemory;
    }

    const stored = uni.getStorageSync(KEY_BUNDLE_STORAGE_KEY) as string;
    if (!stored) {
      return null;
    }

    try {
      const parsed = JSON.parse(stored) as EncryptedVaultKeyBundle;
      if (parsed.encryptedVaultKey && parsed.kdfSalt && parsed.kdfParams) {
        keyBundleMemory = parsed;
        return keyBundleMemory;
      }
    } catch {
      uni.removeStorageSync(KEY_BUNDLE_STORAGE_KEY);
    }

    return keyBundleMemory;
  },

  setRecoveryBundle(encryptedVaultKeyByRecovery: string) {
    recoveryBundleMemory = encryptedVaultKeyByRecovery;
    uni.setStorageSync(RECOVERY_BUNDLE_STORAGE_KEY, encryptedVaultKeyByRecovery);
  },

  getRecoveryBundle() {
    if (recoveryBundleMemory) {
      return recoveryBundleMemory;
    }
    recoveryBundleMemory = (uni.getStorageSync(RECOVERY_BUNDLE_STORAGE_KEY) as string) || null;
    return recoveryBundleMemory;
  },

  setRecoverySalt(recoverySalt: string) {
    recoverySaltMemory = recoverySalt;
    uni.setStorageSync(RECOVERY_SALT_STORAGE_KEY, recoverySalt);
  },

  getRecoverySalt() {
    if (recoverySaltMemory) {
      return recoverySaltMemory;
    }
    recoverySaltMemory = (uni.getStorageSync(RECOVERY_SALT_STORAGE_KEY) as string) || null;
    return recoverySaltMemory;
  },

  setPendingPhone(phone: string) {
    pendingPhone = phone;
  },

  getPendingPhone() {
    return pendingPhone;
  },

  clearPendingPhone() {
    pendingPhone = '';
  },

  setPendingEmail(email: string) {
    pendingEmail = email;
  },

  getPendingEmail() {
    return pendingEmail;
  },

  clearPendingEmail() {
    pendingEmail = '';
  },

  setPendingUsername(username: string) {
    pendingUsername = username;
  },

  getPendingUsername() {
    return pendingUsername;
  },

  clearPendingUsername() {
    pendingUsername = '';
  },

  setPendingPassword(password: string) {
    pendingPassword = password;
  },

  getPendingPassword() {
    return pendingPassword;
  },

  clearPendingPassword() {
    pendingPassword = '';
  },

  setPendingWxCode(code: string) {
    pendingWxCode = code;
  },

  getPendingWxCode() {
    return pendingWxCode;
  },

  clearPendingWxCode() {
    pendingWxCode = '';
  },

  clearPendingRegisterIdentity() {
    pendingPhone = '';
    pendingEmail = '';
    pendingUsername = '';
    pendingPassword = '';
    pendingWxCode = '';
  },

  setPendingVaultSetup(setup: { recoveryKey: string; recoveryLastGroup: string }) {
    pendingVaultSetup = setup;
  },

  getPendingVaultSetup() {
    return pendingVaultSetup;
  },

  clearPendingVaultSetup() {
    pendingVaultSetup = null;
  },

  logout() {
    vaultSession.clearVaultKey();
    keyBundleMemory = null;
    recoveryBundleMemory = null;
    recoverySaltMemory = null;
    pendingVaultSetup = null;
    clearToken();
    vaultSession.clearPendingRegisterIdentity();
  },
};

export async function encryptText(value: string, vaultKey: Uint8Array) {
  const { encryptJson } = await import('@vaultpass/crypto');
  return encryptJson({ value }, vaultKey);
}

export async function decryptText(ciphertext: string) {
  const { decryptJson } = await import('@vaultpass/crypto');
  const vaultKey = vaultSession.requireVaultKey();
  const result = await decryptJson<{ value: string }>(ciphertext, vaultKey);
  return result.value;
}

let contactVaultKeyMemory: Uint8Array | null = null;
let contactSessionIdMemory = '';

export function downloadEncryptedFile(fileId: string, mfaCode?: string) {
  const token = uni.getStorageSync(TOKEN_STORAGE_KEY) as string;

  return new Promise<ArrayBuffer>((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}/files/${fileId}/download`,
      method: 'GET',
      responseType: 'arraybuffer',
      header: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(mfaCode ? { 'X-Mfa-Code': mfaCode } : {}),
      },
      success: (res) => {
        if (res.statusCode >= 400) {
          reject(new Error(`下载失败 (${res.statusCode})`));
          return;
        }
        resolve(res.data as ArrayBuffer);
      },
      fail: (error) => reject(new Error(error.errMsg || '下载失败')),
    });
  });
}

export function downloadContactVaultFile(sessionId: string, fileId: string) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}/contact-takeover/${sessionId}/vault/files/${fileId}/download`,
      method: 'GET',
      responseType: 'arraybuffer',
      success: (res) => {
        if (res.statusCode >= 400) {
          reject(new Error(`下载失败 (${res.statusCode})`));
          return;
        }
        resolve(res.data as ArrayBuffer);
      },
      fail: (error) => reject(new Error(error.errMsg || '下载失败')),
    });
  });
}

export const contactVaultSession = {
  setSession(sessionId: string, vaultKey: Uint8Array) {
    contactVaultSession.clearVaultKey();
    contactSessionIdMemory = sessionId;
    contactVaultKeyMemory = vaultKey;
  },

  getSessionId() {
    return contactSessionIdMemory;
  },

  requireVaultKey() {
    if (!contactVaultKeyMemory) {
      throw new Error('联系人会话未解锁');
    }
    return contactVaultKeyMemory;
  },

  clearVaultKey() {
    if (contactVaultKeyMemory) {
      zeroize(contactVaultKeyMemory);
      contactVaultKeyMemory = null;
    }
  },

  clear() {
    contactVaultSession.clearVaultKey();
    contactSessionIdMemory = '';
  },
};

export type { KdfParams };
