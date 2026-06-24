import { sha256 } from '@noble/hashes/sha2';
import {
  AES_KEY_LENGTH,
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
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
  hashChallengeAnswer,
  normalizeChallengeAnswer,
  randomBytesAsync,
  utf8ToBytes,
  zeroize,
} from '@vaultpass/crypto';
import { DEFAULT_KDF_PARAMS } from '@vaultpass/crypto';
import type { FileMetadata } from '@vaultpass/types';
import { vaultSession } from './api';
import { friendlyErrorMessage } from './errors';

type DerivedMasterKeyMessage =
  | {
      id: string;
      type: 'derive-master-key:success';
      masterKey: string;
      kdfSalt: string;
      kdfParams: ReturnType<typeof deriveMasterKeyByPassword>['kdfParams'];
    }
  | {
      id: string;
      type: 'derive-master-key:error';
      message?: string;
    };

interface MiniProgramWorker {
  postMessage: (message: Record<string, unknown>) => void;
  onMessage: (callback: (message: DerivedMasterKeyMessage) => void) => void;
  onError?: (callback: (error: { errMsg?: string; message?: string }) => void) => void;
  terminate: () => void;
}

interface WxWorkerRuntime {
  createWorker?: (scriptPath: string) => MiniProgramWorker;
}

function getWxWorkerRuntime(): WxWorkerRuntime | undefined {
  return (globalThis as typeof globalThis & { wx?: WxWorkerRuntime }).wx;
}

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
  const vaultKey = await randomBytesAsync(AES_KEY_LENGTH);
  const recoveryKey = await generateRecoveryKeyAsync();
  const master = deriveMasterKey(masterPassword, await randomBytesAsync(16));
  const recovery = deriveRecoveryKeyByPhrase(recoveryKey, await randomBytesAsync(16));

  try {
    const encryptedVaultKey = await encryptVaultKey(vaultKey, master.masterKey);
    const encryptedVaultKeyByRecovery = await encryptVaultKeyByRecovery(
      vaultKey,
      recovery.masterKey,
    );

    return {
      vaultKey,
      recoveryKey,
      recoverySalt: recovery.kdfSalt,
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

const RECOVERY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

async function generateRecoveryKeyAsync() {
  const bytes = await randomBytesAsync(24);
  const chars = Array.from(bytes, (byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length]);
  return Array.from({ length: 6 }, (_, index) => chars.slice(index * 4, index * 4 + 4).join('')).join('-');
}

async function deriveMasterKeyInWorker(
  password: string,
  salt: string,
  params: ReturnType<typeof deriveMasterKeyByPassword>['kdfParams'],
) {
  const wxRuntime = getWxWorkerRuntime();
  if (!wxRuntime?.createWorker) {
    throw new Error('当前运行环境不支持 Worker');
  }

  const worker = wxRuntime.createWorker('static/workers/derive-master-key.js');
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return new Promise<ReturnType<typeof deriveMasterKeyByPassword>>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();
      reject(new Error('密钥派生超时，请重试'));
    }, 120000);

    function finish(callback: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker.terminate();
      callback();
    }

    worker.onMessage((message) => {
      if (!message || message.id !== id) return;
      if (message.type === 'derive-master-key:success') {
        finish(() => {
          resolve({
            masterKey: base64ToBytes(message.masterKey),
            kdfSalt: message.kdfSalt,
            kdfParams: message.kdfParams,
          });
        });
        return;
      }

      finish(() => {
        reject(new Error(message.message || '密钥派生失败'));
      });
    });

    worker.onError?.((error) => {
      finish(() => {
        reject(new Error(friendlyErrorMessage(error.errMsg || error.message, 'Worker 密钥派生失败')));
      });
    });

    worker.postMessage({
      id,
      type: 'derive-master-key',
      password,
      salt,
      params,
    });
  });
}

async function deriveMasterKeyPreferWorker(
  password: string,
  salt: string,
  params: ReturnType<typeof deriveMasterKeyByPassword>['kdfParams'],
) {
  const wxRuntime = getWxWorkerRuntime();
  if (!wxRuntime?.createWorker) {
    return deriveMasterKeyByPassword(password, salt, params);
  }
  return deriveMasterKeyInWorker(password, salt, params);
}

export async function unlockVaultWithMasterPassword(
  masterPassword: string,
  progress?: {
    beforeDerive?: () => void;
    afterDerive?: () => void;
    afterDecrypt?: () => void;
  },
) {
  const bundle = vaultSession.getKeyBundle();
  if (!bundle) {
    throw new Error('缺少密钥包，请重新登录');
  }

  progress?.beforeDerive?.();
  const derived = await deriveMasterKeyPreferWorker(
    masterPassword,
    bundle.kdfSalt,
    bundle.kdfParams,
  );
  progress?.afterDerive?.();
  try {
    const vaultKey = await decryptVaultKey(bundle.encryptedVaultKey, derived.masterKey);
    progress?.afterDecrypt?.();
    vaultSession.setVaultKey(vaultKey);
    return vaultKey;
  } catch (error) {
    throw new Error(friendlyErrorMessage(error, '主密码错误，请重新输入'));
  }
}

export async function encryptVaultItemPayload(payload: object, title: string) {
  const vaultKey = vaultSession.requireVaultKey();
  const titleCiphertext = await encryptJson({ title }, vaultKey);
  const encryptedPayload = await encryptJson(payload, vaultKey);
  return { titleCiphertext, encryptedPayload };
}

export async function decryptVaultTitle(titleCiphertext: string) {
  const vaultKey = vaultSession.requireVaultKey();
  try {
    const data = await decryptJson<{ title: string }>(titleCiphertext, vaultKey);
    return data.title;
  } catch (error) {
    throw new Error(friendlyErrorMessage(error, '标题解密失败'));
  }
}

export async function decryptVaultPayload<T extends object>(encryptedPayload: string) {
  const vaultKey = vaultSession.requireVaultKey();
  try {
    return await decryptJson<T>(encryptedPayload, vaultKey);
  } catch (error) {
    throw new Error(friendlyErrorMessage(error, '内容解密失败'));
  }
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
  try {
    return await decryptJson<FileMetadata>(ciphertext, vaultKey);
  } catch (error) {
    throw new Error(friendlyErrorMessage(error, '文件信息解密失败'));
  }
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
  const encryptedBytes = utf8ToBytes(encryptedContent);
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
  const encryptedContent = bytesToUtf8(new Uint8Array(buffer));
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
      fail: (error) => reject(new Error(friendlyErrorMessage(error.errMsg, '写入预览文件失败'))),
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
      fail: (error) => reject(new Error(friendlyErrorMessage(error.errMsg, '读取文件失败'))),
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
      fail: (error) => reject(new Error(friendlyErrorMessage(error.errMsg, '写入临时文件失败'))),
    });
  });
}

export { DEFAULT_KDF_PARAMS };
export { calculatePasswordStrength };

export function computeLookupHash(value: string) {
  const normalized = value.trim().toLowerCase();
  return bytesToBase64(sha256(utf8ToBytes(normalized)));
}

function deriveContactKey(answer: string) {
  return sha256(utf8ToBytes(normalizeChallengeAnswer(answer)));
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
  try {
    const payload = await decryptJson<{ key: string }>(encryptedFileKey, vaultKey);
    return await decryptFile(encryptedContent, base64ToBytes(payload.key));
  } catch (error) {
    throw new Error(friendlyErrorMessage(error, '文件解密失败'));
  }
}

function deriveRecoveryKey(recoveryPassphrase: string) {
  return sha256(utf8ToBytes(normalizeChallengeAnswer(recoveryPassphrase)));
}

export async function buildRecoveryKeyPayload(recoveryPassphrase: string) {
  const vaultKey = vaultSession.requireVaultKey();
  const recovery = deriveRecoveryKeyByPhrase(recoveryPassphrase, await randomBytesAsync(16));
  try {
    return {
      encryptedVaultKeyByRecovery: await encryptVaultKeyByRecovery(vaultKey, recovery.masterKey),
      recoverySalt: recovery.kdfSalt,
    };
  } finally {
    zeroize(recovery.masterKey);
  }
}

export async function unlockVaultWithRecoveryKey(
  recoveryPassphrase: string,
  encryptedVaultKeyByRecovery: string,
) {
  const recoverySalt = vaultSession.getRecoverySalt();
  if (recoverySalt) {
    const derived = deriveRecoveryKeyByPhrase(
      recoveryPassphrase,
      recoverySalt,
      vaultSession.getKeyBundle()?.kdfParams,
    );
    try {
      const vaultKey = await decryptVaultKey(encryptedVaultKeyByRecovery, derived.masterKey);
      vaultSession.setVaultKey(vaultKey);
      return vaultKey;
    } catch (error) {
      throw new Error(friendlyErrorMessage(error, '恢复密钥不正确，请重新输入'));
    }
  }

  try {
    const payload = await decryptJson<{ vaultKey: string }>(
      encryptedVaultKeyByRecovery,
      deriveRecoveryKey(recoveryPassphrase),
    );
    const vaultKey = base64ToBytes(payload.vaultKey);
    vaultSession.setVaultKey(vaultKey);
    return vaultKey;
  } catch (error) {
    throw new Error(friendlyErrorMessage(error, '恢复密钥不正确，请重新输入'));
  }
}

export async function buildRecoveredMasterPasswordPayload(
  recoveryPassphrase: string,
  encryptedVaultKeyByRecovery: string,
  newMasterPassword: string,
) {
  const vaultKey = await unlockVaultWithRecoveryKey(recoveryPassphrase, encryptedVaultKeyByRecovery);
  const master = deriveMasterKey(newMasterPassword, await randomBytesAsync(16));
  try {
    const encryptedVaultKey = await encryptVaultKey(vaultKey, master.masterKey);

    return {
      vaultKey,
      keyBundle: {
        encryptedVaultKey,
        kdfSalt: master.kdfSalt,
        kdfParams: master.kdfParams,
      },
      payload: {
        encryptedVaultKey,
        passwordSalt: master.kdfSalt,
        kdfParams: master.kdfParams,
      },
    };
  } finally {
    zeroize(master.masterKey);
  }
}

export async function decryptContactVaultKey(encryptedVaultKeyForContact: string, answer: string) {
  try {
    const payload = await decryptJson<{ vaultKey: string }>(
      encryptedVaultKeyForContact,
      deriveContactKey(answer),
    );
    return base64ToBytes(payload.vaultKey);
  } catch (error) {
    throw new Error(friendlyErrorMessage(error, '验证答案不正确，请重新输入'));
  }
}
