import { encryptBytes, decryptBytes } from './aes/gcm.js';
import { parseCipherPayload, serializeCipherBlock } from './utils/serialize.js';

/**
 * 使用 master_key 加密 vault_key，供服务器存储 encrypted_vault_key。
 * 服务器无法解密 vault_key。
 */
export async function encryptVaultKey(
  vaultKey: Uint8Array,
  masterKey: Uint8Array,
): Promise<string> {
  const encrypted = await encryptBytes(vaultKey, masterKey);
  return JSON.stringify(serializeCipherBlock(encrypted));
}

/** 使用 master_key 解密 vault_key */
export async function decryptVaultKey(
  encryptedVaultKey: string,
  masterKey: Uint8Array,
): Promise<Uint8Array> {
  const payload = parseCipherPayload(encryptedVaultKey);
  return decryptBytes(payload, masterKey);
}
