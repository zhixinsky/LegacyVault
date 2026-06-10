import { AES_KEY_LENGTH } from './constants.js';
import { randomBytes } from './utils/encoding.js';

/** 生成用于加密保险箱数据的 vault_key（256 bit） */
export function generateVaultKey(): Uint8Array {
  return randomBytes(AES_KEY_LENGTH);
}

/** 生成用于加密单个文件的 file_key（256 bit） */
export function generateFileKey(): Uint8Array {
  return randomBytes(AES_KEY_LENGTH);
}
