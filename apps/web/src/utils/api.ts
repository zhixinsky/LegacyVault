import type { EncryptedVaultKeyBundle } from '@vaultpass/types';
import { decryptJson, zeroize } from '@vaultpass/crypto';
import { API_BASE_URL, DEVICE_ID_STORAGE_KEY, TOKEN_STORAGE_KEY } from '@/config';

export function getDeviceId() {
  let deviceId = sessionStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    sessionStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  }
  return deviceId;
}

function buildAuthHeaders(token?: string | null, mfaCode?: string) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'X-Device-Id': getDeviceId(),
    ...(mfaCode ? { 'X-Mfa-Code': mfaCode } : {}),
  };
}

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
  mfaCode?: string;
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

export async function request<T>(options: RequestOptions): Promise<T> {
  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  headers['X-Device-Id'] = getDeviceId();

  if (options.mfaCode) {
    headers['X-Mfa-Code'] = options.mfaCode;
  }

  const response = await fetch(buildUrl(options.url, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`请求失败 (${response.status})`);
  }

  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (envelope.code !== 0) {
    throw new Error(envelope.message || '请求失败');
  }

  return envelope.data;
}

export async function publicRequest<T>(options: RequestOptions): Promise<T> {
  const response = await fetch(buildUrl(options.url, options.query), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`请求失败 (${response.status})`);
  }

  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (envelope.code !== 0) {
    throw new Error(envelope.message || '请求失败');
  }

  return envelope.data;
}

export function saveToken(token: string) {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

let vaultKeyMemory: Uint8Array | null = null;
let keyBundleMemory: EncryptedVaultKeyBundle | null = null;
let recoveryBundleMemory: string | null = null;
let pendingVaultSetup:
  | {
      recoveryKey: string;
      recoveryLastGroup: string;
    }
  | null = null;
let pendingPhone = '';

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
  },

  getKeyBundle() {
    return keyBundleMemory;
  },

  setRecoveryBundle(encryptedVaultKeyByRecovery: string) {
    recoveryBundleMemory = encryptedVaultKeyByRecovery;
  },

  getRecoveryBundle() {
    return recoveryBundleMemory;
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
    pendingVaultSetup = null;
    clearToken();
    pendingPhone = '';
  },
};

export async function decryptText(ciphertext: string) {
  const vaultKey = vaultSession.requireVaultKey();
  const result = await decryptJson<{ value: string }>(ciphertext, vaultKey);
  return result.value;
}

export async function uploadEncryptedFile(file: Blob, formData: Record<string, string | number>) {
  const token = getToken();
  const body = new FormData();
  body.append('file', file, 'upload.enc');

  Object.entries(formData).forEach(([key, value]) => {
    body.append(key, String(value));
  });

  const response = await fetch(buildUrl('/files/upload'), {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body,
  });

  if (!response.ok) {
    throw new Error(`上传失败 (${response.status})`);
  }

  const envelope = (await response.json()) as ApiEnvelope<unknown>;
  if (envelope.code !== 0) {
    throw new Error(envelope.message || '上传失败');
  }

  return envelope.data;
}

export async function downloadEncryptedFile(fileId: string, mfaCode?: string) {
  const token = getToken();
  const response = await fetch(buildUrl(`/files/${fileId}/download`), {
    headers: buildAuthHeaders(token, mfaCode),
  });

  if (!response.ok) {
    throw new Error(`下载失败 (${response.status})`);
  }

  return response.arrayBuffer();
}

export async function downloadContactVaultFile(sessionId: string, fileId: string) {
  const response = await fetch(
    buildUrl(`/contact-takeover/${sessionId}/vault/files/${fileId}/download`),
  );

  if (!response.ok) {
    throw new Error(`下载失败 (${response.status})`);
  }

  return response.arrayBuffer();
}

let contactVaultKeyMemory: Uint8Array | null = null;
let contactSessionIdMemory = '';

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
