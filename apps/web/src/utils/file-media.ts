import { decryptStoredFile } from '@/utils/crypto-flow';

export async function decryptDownloadedFile(
  buffer: ArrayBuffer,
  encryptedFileKey: string,
  mimeType: string,
) {
  const encryptedContent = new TextDecoder().decode(new Uint8Array(buffer));
  const decrypted = await decryptStoredFile(encryptedContent, encryptedFileKey);
  return new Blob([new Uint8Array(decrypted)], { type: mimeType || 'application/octet-stream' });
}

export function createObjectUrl(blob: Blob) {
  return URL.createObjectURL(blob);
}

export function revokeObjectUrl(url: string) {
  URL.revokeObjectURL(url);
}
