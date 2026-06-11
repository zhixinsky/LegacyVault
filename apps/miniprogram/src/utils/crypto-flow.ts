import { sha256 } from '@noble/hashes/sha2';
import {
  AES_KEY_LENGTH,
  base64ToBytes,
  bytesToBase64,
  calculatePasswordStrength,
  decryptJson,
  decryptVaultKey,
  deriveMasterKey,
  deriveRecoveryKey as deriveRecoveryKeyByPhrase,
  deriveMasterKeyByPassword,
  encryptFile,
  encryptJson,
  encryptVaultKey,
  encryptVaultKeyByRecovery,
  generateRecoveryKey,
  generateVaultKey,
  hashChallengeAnswer,
  normalizeChallengeAnswer,
  randomBytesAsync,
  zeroize,
} from '@vaultpass/crypto';
import { DEFAULT_KDF_PARAMS } from '@vaultpass/crypto';
import type { FileMetadata } from '@vaultpass/types';
import { vaultSession } from './api';

export async function registerWithMasterPassword(
  identity: { phone?: string; email?: string; username?: string; password?: string },
  masterPassword: string,
) {
  const derived = deriveMasterKeyByPassword(masterPassword, await randomBytesAsync(16));
  const vaultKey = await randomBytesAsync(AES_KEY_LENGTH);
  const encryptedVaultKey = await encryptVaultKey(vaultKey, derived.masterKey);

  return {
    derived,
    vaultKey,
    registerPayload: {
      ...identity,
      encryptedVaultKey,
      kdfSalt: derived.kdfSalt,
      kdfParams: derived.kdfParams,
    },
  };
}

export async function buildCreateVaultPayload(masterPassword: string) {
  const vaultKey = generateVaultKey();
  const recoveryKey = generateRecoveryKey();
  const master = deriveMasterKey(masterPassword);
  const recovery = deriveRecoveryKeyByPhrase(recoveryKey);

  try {
    const encryptedVaultKey = await encryptVaultKey(vaultKey, master.masterKey);
    const encryptedVaultKeyByRecovery = await encryptVaultKeyByRecovery(
      vaultKey,
      recovery.masterKey,
    );

    return {
      vaultKey,
      recoveryKey,
      keyBundle: {
        encryptedVaultKey,
        kdfSalt: master.kdfSalt,
        kdfParams: master.kdfParams,
      },
      recoveryBundle: encryptedVaultKeyByRecovery,
      createPayload: {
        encryptedVaultKey,
        encryptedVaultKeyByRecovery,
        passwordSalt: master.kdfSalt,
        recoverySalt: recovery.kdfSalt,
        kdfParams: master.kdfParams,
      },
    };
  } finally {
    zeroize(master.masterKey);
    zeroize(recovery.masterKey);
  }
}

export async function unlockVaultWithMasterPassword(masterPassword: string) {
  const bundle = vaultSession.getKeyBundle();
  if (!bundle) {
    throw new Error('缺少密钥包，请重新登录');
  }

  const derived = deriveMasterKeyByPassword(
    masterPassword,
    bundle.kdfSalt,
    bundle.kdfParams,
  );
  const vaultKey = await decryptVaultKey(bundle.encryptedVaultKey, derived.masterKey);
  vaultSession.setVaultKey(vaultKey);
  return vaultKey;
}

export async function encryptVaultItemPayload(payload: Record<string, string>, title: string) {
  const vaultKey = vaultSession.requireVaultKey();
  const titleCiphertext = await encryptJson({ title }, vaultKey);
  const encryptedPayload = await encryptJson(payload, vaultKey);
  return { titleCiphertext, encryptedPayload };
}

export async function decryptVaultTitle(titleCiphertext: string) {
  const vaultKey = vaultSession.requireVaultKey();
  const data = await decryptJson<{ title: string }>(titleCiphertext, vaultKey);
  return data.title;
}

export async function decryptVaultPayload<T extends Record<string, string>>(encryptedPayload: string) {
  const vaultKey = vaultSession.requireVaultKey();
  return decryptJson<T>(encryptedPayload, vaultKey);
}

export async function encryptField(value: string) {
  const vaultKey = vaultSession.requireVaultKey();
  return encryptJson({ value }, vaultKey);
}

export async function encryptFileMetadata(metadata: FileMetadata) {
  const vaultKey = vaultSession.requireVaultKey();
  return encryptJson(metadata, vaultKey);
}

export async function decryptFileMetadata(ciphertext?: string | null): Promise<FileMetadata> {
  if (!ciphertext) {
    return {};
  }
  const vaultKey = vaultSession.requireVaultKey();
  return decryptJson<FileMetadata>(ciphertext, vaultKey);
}

function guessMimeTypeFromPath(filePath: string, fallback = 'application/octet-stream') {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
  };
  return ext && map[ext] ? map[ext] : fallback;
}

export async function prepareEncryptedUpload(
  filePath: string,
  fileType: string,
  albumId?: string,
  mimeType?: string,
  metadata?: FileMetadata,
) {
  const vaultKey = vaultSession.requireVaultKey();
  const resolvedMime = mimeType || guessMimeTypeFromPath(filePath);

  const fileData = await readFileAsUint8Array(filePath);
  const fileKey = await randomBytesAsync(AES_KEY_LENGTH);
  const encryptedContent = await encryptFile(fileData, fileKey);
  const encryptedFileKey = await encryptJson({ key: bytesToBase64(fileKey) }, vaultKey);
  const encryptedBytes = new TextEncoder().encode(encryptedContent);
  const tempPath = filePath.replace(/(\.[^./\\]+)?$/, '.enc');

  await writeUtf8File(tempPath, encryptedContent);

  return {
    tempPath,
    formData: {
      fileType,
      encryptedFileKey,
      fileHash: bytesToBase64(sha256(encryptedBytes)),
      fileSize: encryptedBytes.length,
      mimeType: resolvedMime,
      ...(albumId ? { albumId } : {}),
      ...(metadata && (metadata.displayName || metadata.tags || metadata.note)
        ? { encryptedMetadata: await encryptFileMetadata(metadata) }
        : {}),
    },
  };
}

export async function decryptDownloadedBuffer(
  buffer: ArrayBuffer,
  encryptedFileKey: string,
) {
  const vaultKey = vaultSession.requireVaultKey();
  const encryptedContent = new TextDecoder().decode(new Uint8Array(buffer));
  return decryptStoredFile(encryptedContent, encryptedFileKey, vaultKey);
}

export function writeDecryptedPreviewFile(data: Uint8Array, ext: string) {
  const userDataPath = (uni as unknown as { env?: { USER_DATA_PATH?: string } }).env?.USER_DATA_PATH ?? '';
  const filePath = `${userDataPath}/vp-preview-${Date.now()}.${ext}`;
  return new Promise<string>((resolve, reject) => {
    const bytes = data.slice();
    uni.getFileSystemManager().writeFile({
      filePath,
      data: bytes.buffer,
      success: () => resolve(filePath),
      fail: (error) => reject(new Error(error.errMsg || '写入预览文件失败')),
    });
  });
}

function readFileAsUint8Array(filePath: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    uni.getFileSystemManager().readFile({
      filePath,
      success: (res) => {
        resolve(new Uint8Array(res.data as ArrayBuffer));
      },
      fail: (error) => reject(new Error(error.errMsg || '读取文件失败')),
    });
  });
}

function writeUtf8File(filePath: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    uni.getFileSystemManager().writeFile({
      filePath,
      data: content,
      encoding: 'utf8',
      success: () => resolve(),
      fail: (error) => reject(new Error(error.errMsg || '写入临时文件失败')),
    });
  });
}

export { DEFAULT_KDF_PARAMS };
export { calculatePasswordStrength };

export function computeLookupHash(value: string) {
  const normalized = value.trim().toLowerCase();
  return bytesToBase64(sha256(new TextEncoder().encode(normalized)));
}

function deriveContactKey(answer: string) {
  return sha256(new TextEncoder().encode(normalizeChallengeAnswer(answer)));
}

export async function buildContactTakeoverMaterials(questionLabel: string, answer: string) {
  const vaultKey = vaultSession.requireVaultKey();
  const answerHash = hashChallengeAnswer(answer);
  const encryptedVaultKeyForContact = await encryptJson(
    { vaultKey: bytesToBase64(vaultKey) },
    deriveContactKey(answer),
  );

  return {
    questionLabel,
    encryptedQuestion: await encryptField(questionLabel),
    encryptedAnswerHash: JSON.stringify(answerHash),
    encryptedVaultKeyForContact,
  };
}

export async function decryptStoredFile(
  encryptedContent: string,
  encryptedFileKey: string,
  vaultKey: Uint8Array,
) {
  const { decryptFile } = await import('@vaultpass/crypto');
  const payload = await decryptJson<{ key: string }>(encryptedFileKey, vaultKey);
  return decryptFile(encryptedContent, base64ToBytes(payload.key));
}

function deriveRecoveryKey(recoveryPassphrase: string) {
  return sha256(new TextEncoder().encode(normalizeChallengeAnswer(recoveryPassphrase)));
}

export async function buildRecoveryKeyPayload(recoveryPassphrase: string) {
  const vaultKey = vaultSession.requireVaultKey();
  return encryptJson({ vaultKey: bytesToBase64(vaultKey) }, deriveRecoveryKey(recoveryPassphrase));
}

export async function unlockVaultWithRecoveryKey(
  recoveryPassphrase: string,
  encryptedVaultKeyByRecovery: string,
) {
  const payload = await decryptJson<{ vaultKey: string }>(
    encryptedVaultKeyByRecovery,
    deriveRecoveryKey(recoveryPassphrase),
  );
  const vaultKey = base64ToBytes(payload.vaultKey);
  vaultSession.setVaultKey(vaultKey);
  return vaultKey;
}

export async function decryptContactVaultKey(encryptedVaultKeyForContact: string, answer: string) {
  const payload = await decryptJson<{ vaultKey: string }>(
    encryptedVaultKeyForContact,
    deriveContactKey(answer),
  );
  return base64ToBytes(payload.vaultKey);
}
