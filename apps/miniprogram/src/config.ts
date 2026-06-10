/** API 基础地址，开发时可改为局域网 IP */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export const TOKEN_STORAGE_KEY = 'vp_access_token';
export const DEVICE_ID_STORAGE_KEY = 'vp_device_id';
