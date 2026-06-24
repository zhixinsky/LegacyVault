function stringifyError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const maybeMessage = (error as { message?: unknown; errMsg?: unknown }).message
      ?? (error as { message?: unknown; errMsg?: unknown }).errMsg;
    if (typeof maybeMessage === 'string') return maybeMessage;
  }
  return '';
}

export function friendlyErrorMessage(error: unknown, fallback = '操作失败') {
  const message = stringifyError(error).trim();
  if (!message) return fallback;
  const lower = message.toLowerCase();

  if (
    lower.includes('unsupported state') ||
    lower.includes('unable to authenticate') ||
    lower.includes('bad decrypt') ||
    lower.includes('decrypt failed') ||
    lower.includes('operationerror') ||
    lower.includes('authentication failed') ||
    lower.includes('ciphertext') ||
    lower.includes('invalid tag') ||
    lower.includes('mac check failed')
  ) {
    return '解密失败，请检查主密码或密钥是否正确';
  }

  if (lower.includes('argon') || lower.includes('derive') || lower.includes('kdf')) {
    return '密钥计算失败，请稍后重试';
  }

  if (lower.includes('worker')) {
    return '安全计算线程异常，请稍后重试';
  }

  if (lower.includes('timeout') || message.includes('超时')) {
    return '请求超时，请稍后重试';
  }

  if (
    lower.includes('network') ||
    lower.includes('request:fail') ||
    lower.includes('connect') ||
    lower.includes('socket') ||
    lower.includes('abort') ||
    message.includes('网络')
  ) {
    return '网络连接失败，请检查网络后重试';
  }

  if (lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('401')) {
    return '登录状态已失效，请重新登录';
  }

  if (lower.includes('not found') || lower.includes('404')) {
    return '请求的内容不存在或已被删除';
  }

  if (lower.includes('payload too large') || lower.includes('413')) {
    return '文件过大，请选择更小的文件';
  }

  if (lower.includes('internal server error') || lower.includes('500')) {
    return '服务器开小差了，请稍后重试';
  }

  if (/^[\x00-\x7F]+$/.test(message)) {
    return fallback;
  }

  return message;
}

export function friendlyError(error: unknown, fallback = '操作失败') {
  return new Error(friendlyErrorMessage(error, fallback));
}
