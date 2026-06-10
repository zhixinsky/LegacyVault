export function isImageMime(mimeType?: string) {
  return Boolean(mimeType?.startsWith('image/'));
}

export function isVideoMime(mimeType?: string) {
  return Boolean(mimeType?.startsWith('video/'));
}

export function isImageFile(file: { fileType?: string; mimeType?: string }) {
  return file.fileType === 'image' || isImageMime(file.mimeType);
}

export function isVideoFile(file: { fileType?: string; mimeType?: string }) {
  return file.fileType === 'video' || isVideoMime(file.mimeType);
}

export function isPreviewableMedia(file: { fileType?: string; mimeType?: string }) {
  return isImageFile(file) || isVideoFile(file);
}

export function guessMimeTypeFromPath(filePath: string, fallback = 'application/octet-stream') {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    m4v: 'video/x-m4v',
  };
  return ext && map[ext] ? map[ext] : fallback;
}

export function extensionFromMime(mimeType: string) {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  };
  return map[mimeType] ?? 'bin';
}
