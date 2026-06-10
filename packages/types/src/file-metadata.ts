/** 加密文件元数据（客户端加密后存入 encrypted_metadata） */
export interface FileMetadata {
  displayName?: string;
  tags?: string;
  note?: string;
}

/** 将标签字符串拆分为数组（支持中英文逗号、空格） */
export function parseFileTags(tags?: string): string[] {
  if (!tags?.trim()) {
    return [];
  }
  return tags
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
