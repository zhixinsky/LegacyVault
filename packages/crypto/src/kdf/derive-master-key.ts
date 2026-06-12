import { argon2id } from '@noble/hashes/argon2';
import { AES_KEY_LENGTH, DEFAULT_KDF_PARAMS } from '../constants.js';
import type { DerivedMasterKey, KdfParams } from '../types.js';
import { base64ToBytes, bytesToBase64, randomBytes, utf8ToBytes } from '../utils/encoding.js';

/**
 * 从用户主密码派生 master_key。
 *
 * 安全要求：
 * - 主密码仅在客户端调用，禁止发送到后端
 * - 返回的 masterKey 仅应保存在内存/session，禁止长期写入 localStorage
 */
export function deriveMasterKeyByPassword(
  password: string,
  salt?: Uint8Array | string,
  params?: Partial<KdfParams>,
): DerivedMasterKey {
  if (!password) {
    throw new Error('Password must not be empty');
  }

  const kdfParams: KdfParams = {
    ...DEFAULT_KDF_PARAMS,
    ...params,
  };

  const saltBytes =
    typeof salt === 'string' ? base64ToBytes(salt) : (salt ?? randomBytes(16));

  const masterKey = argon2id(utf8ToBytes(password), saltBytes, {
    t: kdfParams.iterations,
    m: kdfParams.memory,
    p: kdfParams.parallelism,
    dkLen: AES_KEY_LENGTH,
  });

  return {
    masterKey,
    kdfSalt: bytesToBase64(saltBytes),
    kdfParams,
  };
}
