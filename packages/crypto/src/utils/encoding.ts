/** 将 Uint8Array 转为 Base64 字符串 */
export function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binString);
}

/** 将 Base64 字符串转为 Uint8Array */
export function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (char) => char.charCodeAt(0));
}

/** 生成加密安全的随机字节 */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** 常量时间比较，防止时序攻击 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

/** 尝试清零敏感内存（最佳努力，JS 无法保证被 GC 回收前不被复制） */
export function zeroize(bytes: Uint8Array): void {
  bytes.fill(0);
}
