/** 将 Uint8Array 转为 Base64 字符串 */
export function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i]!;
    const b2 = bytes[i + 1];
    const b3 = bytes[i + 2];
    const chunk = (b1 << 16) | ((b2 ?? 0) << 8) | (b3 ?? 0);

    output += alphabet[(chunk >> 18) & 63];
    output += alphabet[(chunk >> 12) & 63];
    output += b2 === undefined ? '=' : alphabet[(chunk >> 6) & 63];
    output += b3 === undefined ? '=' : alphabet[chunk & 63];
  }

  return output;
}

/** 将 Base64 字符串转为 Uint8Array */
export function base64ToBytes(base64: string): Uint8Array {
  const normalized = base64.replace(/\s/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];

  for (let i = 0; i < normalized.length; i += 4) {
    const c1 = alphabet.indexOf(normalized[i] ?? '');
    const c2 = alphabet.indexOf(normalized[i + 1] ?? '');
    const c3 = normalized[i + 2] === '=' ? -1 : alphabet.indexOf(normalized[i + 2] ?? '');
    const c4 = normalized[i + 3] === '=' ? -1 : alphabet.indexOf(normalized[i + 3] ?? '');

    if (c1 < 0 || c2 < 0 || (c3 < 0 && normalized[i + 2] !== '=') || (c4 < 0 && normalized[i + 3] !== '=')) {
      throw new Error('Invalid base64 string');
    }

    const chunk = (c1 << 18) | (c2 << 12) | ((c3 < 0 ? 0 : c3) << 6) | (c4 < 0 ? 0 : c4);
    bytes.push((chunk >> 16) & 255);
    if (c3 >= 0) {
      bytes.push((chunk >> 8) & 255);
    }
    if (c4 >= 0) {
      bytes.push(chunk & 255);
    }
  }

  return Uint8Array.from(bytes);
}

/** 将字符串转为 UTF-8 字节，兼容没有 TextEncoder 的小程序运行时 */
export function utf8ToBytes(value: string): Uint8Array {
  const TextEncoderCtor = globalThis.TextEncoder;
  if (TextEncoderCtor) {
    return new TextEncoderCtor().encode(value);
  }

  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    let codePoint = value.codePointAt(i)!;
    if (codePoint > 0xffff) {
      i += 1;
    }

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }

  return Uint8Array.from(bytes);
}

/** 将 UTF-8 字节转为字符串，兼容没有 TextDecoder 的小程序运行时 */
export function bytesToUtf8(bytes: Uint8Array): string {
  const TextDecoderCtor = globalThis.TextDecoder;
  if (TextDecoderCtor) {
    return new TextDecoderCtor().decode(bytes);
  }

  let output = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const first = bytes[i]!;
    if (first < 0x80) {
      output += String.fromCodePoint(first);
      continue;
    }

    let codePoint = 0xfffd;
    if (first >= 0xc0 && first < 0xe0 && i + 1 < bytes.length) {
      codePoint = ((first & 0x1f) << 6) | (bytes[i + 1]! & 0x3f);
      i += 1;
    } else if (first >= 0xe0 && first < 0xf0 && i + 2 < bytes.length) {
      codePoint =
        ((first & 0x0f) << 12) |
        ((bytes[i + 1]! & 0x3f) << 6) |
        (bytes[i + 2]! & 0x3f);
      i += 2;
    } else if (first >= 0xf0 && first < 0xf8 && i + 3 < bytes.length) {
      codePoint =
        ((first & 0x07) << 18) |
        ((bytes[i + 1]! & 0x3f) << 12) |
        ((bytes[i + 2]! & 0x3f) << 6) |
        (bytes[i + 3]! & 0x3f);
      i += 3;
    }

    output += String.fromCodePoint(codePoint);
  }

  return output;
}

interface WxRandomValuesResult {
  randomValues: ArrayBuffer;
}

interface WxRandomRuntime {
  getRandomValues?: (options: {
    length: number;
    success?: (res: WxRandomValuesResult) => void;
    fail?: (error: { errMsg?: string }) => void;
  }) => Promise<WxRandomValuesResult> | void;
}

function getWebCrypto() {
  return globalThis.crypto;
}

function getWxRuntime(): WxRandomRuntime | undefined {
  return (globalThis as typeof globalThis & { wx?: WxRandomRuntime }).wx;
}

/** 生成加密安全的随机字节 */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const webCrypto = getWebCrypto();
  if (!webCrypto?.getRandomValues) {
    throw new Error('当前运行环境没有同步安全随机数 API，请使用 randomBytesAsync');
  }
  webCrypto.getRandomValues(bytes);
  return bytes;
}

/** 生成加密安全的随机字节，兼容微信小程序异步随机数 API */
export async function randomBytesAsync(length: number): Promise<Uint8Array> {
  const webCrypto = getWebCrypto();
  if (webCrypto?.getRandomValues) {
    const bytes = new Uint8Array(length);
    webCrypto.getRandomValues(bytes);
    return bytes;
  }

  const wxRuntime = getWxRuntime();
  if (wxRuntime?.getRandomValues) {
    const result = await new Promise<WxRandomValuesResult>((resolve, reject) => {
      const maybePromise = wxRuntime.getRandomValues?.({
        length,
        success: resolve,
        fail: (error) => reject(new Error(error.errMsg || '生成安全随机数失败')),
      });

      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(resolve).catch(reject);
      }
    });
    return new Uint8Array(result.randomValues);
  }

  throw new Error('当前运行环境不支持安全随机数生成');
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
