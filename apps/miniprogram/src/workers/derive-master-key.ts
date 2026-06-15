import { bytesToBase64, deriveMasterKeyByPassword, zeroize } from '@vaultpass/crypto';

declare const worker:
  | {
      onMessage: (callback: (message: {
        id?: string;
        type?: string;
        password?: string;
        salt?: string;
        params?: Parameters<typeof deriveMasterKeyByPassword>[2];
      }) => void) => void;
      postMessage: (message: Record<string, unknown>) => void;
    }
  | undefined;

const workerApi = typeof worker !== 'undefined' ? worker : undefined;

function postMessage(payload: Record<string, unknown>) {
  workerApi?.postMessage(payload);
}

workerApi?.onMessage((message) => {
  if (!message || message.type !== 'derive-master-key') return;

  try {
    if (!message.password || !message.salt) {
      throw new Error('缺少密钥派生参数');
    }

    const derived = deriveMasterKeyByPassword(
      message.password,
      message.salt,
      message.params,
    );

    try {
      postMessage({
        id: message.id,
        type: 'derive-master-key:success',
        masterKey: bytesToBase64(derived.masterKey),
        kdfSalt: derived.kdfSalt,
        kdfParams: derived.kdfParams,
      });
    } finally {
      zeroize(derived.masterKey);
    }
  } catch (error) {
    postMessage({
      id: message.id,
      type: 'derive-master-key:error',
      message: error instanceof Error ? error.message : '密钥派生失败',
    });
  }
});
