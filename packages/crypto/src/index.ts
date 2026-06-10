/**
 * VaultPass 加密模块
 *
 * 安全原则：
 * - 主密码仅在客户端使用，永不发送到服务器
 * - 所有加密使用 AES-256-GCM，每条数据独立 IV
 * - 文件采用分片加密，每片独立 IV
 * - 密钥不得长期明文保存在 localStorage
 */

export { AES_KEY_LENGTH, DEFAULT_FILE_CHUNK_SIZE, DEFAULT_KDF_PARAMS } from './constants.js';

export type {
  ChallengeAnswerHash,
  DerivedMasterKey,
  EncryptedFilePayload,
  KdfParams,
  SerializedCipherPayload,
} from './types.js';

export {
  base64ToBytes,
  bytesToBase64,
  randomBytes,
  timingSafeEqual,
  zeroize,
} from './utils/encoding.js';

export { deriveMasterKeyByPassword } from './kdf/derive-master-key.js';
export { generateVaultKey, generateFileKey } from './vault-key.js';
export { encryptVaultKey, decryptVaultKey } from './vault-crypto.js';
export { encryptJson, decryptJson } from './json-crypto.js';
export { encryptFile, decryptFile } from './file-crypto.js';
export {
  hashChallengeAnswer,
  normalizeChallengeAnswer,
  verifyChallengeAnswer,
} from './challenge.js';
