import { createCipheriv, createDecipheriv } from 'node:crypto';

function getKeyBuffer(secretKey: string) {
  return Buffer.from(secretKey.slice(0, 16).padEnd(16, '0'), 'utf8');
}

export function encryptEmayPayload(text: string, secretKey: string) {
  const cipher = createCipheriv('aes-128-ecb', getKeyBuffer(secretKey), null);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
}

export function decryptEmayPayload(encrypted: Buffer, secretKey: string) {
  const decipher = createDecipheriv('aes-128-ecb', getKeyBuffer(secretKey), null);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
