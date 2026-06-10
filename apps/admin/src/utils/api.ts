import { API_BASE_URL, ADMIN_KEY_STORAGE } from '@/config';

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
  const apiKey = sessionStorage.getItem(ADMIN_KEY_STORAGE);
  if (!apiKey) {
    throw new Error('请先登录管理后台');
  }

  const response = await fetch(buildUrl(options.url, options.query), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Api-Key': apiKey,
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

export function saveAdminKey(key: string) {
  sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
}

export function getAdminKey() {
  return sessionStorage.getItem(ADMIN_KEY_STORAGE);
}

export function clearAdminKey() {
  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
}
