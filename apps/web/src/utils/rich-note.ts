export interface RichNoteNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<Record<string, unknown>>;
  content?: RichNoteNode[];
}

export interface RichNotePayload {
  schemaVersion?: number;
  format?: 'tiptap';
  doc?: RichNoteNode;
  content?: string;
  updatedAt?: string;
}

export const EMPTY_RICH_NOTE_DOC: RichNoteNode = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export function createRichNotePayload(doc: RichNoteNode, plainText: string): RichNotePayload {
  return {
    schemaVersion: 2,
    format: 'tiptap',
    doc,
    content: plainText,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeRichNotePayload(payload: RichNotePayload): Required<Pick<RichNotePayload, 'doc' | 'content'>> {
  if (payload.doc?.type === 'doc') {
    return {
      doc: payload.doc,
      content: payload.content ?? richNoteDocToPlainText(payload.doc),
    };
  }

  const content = payload.content ?? '';
  return {
    doc: plainTextToRichNoteDoc(content),
    content,
  };
}

export function plainTextToRichNoteDoc(value: string): RichNoteNode {
  const lines = value.split(/\n{2,}/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return EMPTY_RICH_NOTE_DOC;

  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    })),
  };
}

export function richNoteDocToPlainText(doc?: RichNoteNode): string {
  if (!doc) return '';
  const parts: string[] = [];
  collectText(doc, parts);
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
}

export function isRichNoteEmpty(doc?: RichNoteNode, fallbackContent = '') {
  return !richNoteDocToPlainText(doc).trim() && !fallbackContent.trim();
}

export function truncateRichNote(value: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function collectText(node: RichNoteNode, parts: string[]) {
  if (node.type === 'encryptedImage') {
    parts.push(`[加密图片${formatAssetName(node)}]\n`);
    return;
  }

  if (node.type === 'encryptedVideo') {
    parts.push(`[加密视频${formatAssetName(node)}]\n`);
    return;
  }

  if (node.type === 'encryptedAttachment') {
    parts.push(`[加密附件${formatAssetName(node)}]\n`);
    return;
  }

  if (node.text) {
    parts.push(node.text);
  }

  if (node.type === 'hardBreak') {
    parts.push('\n');
  }

  for (const child of node.content ?? []) {
    collectText(child, parts);
  }

  if (isBlockNode(node.type)) {
    parts.push('\n');
  }
}

function isBlockNode(type?: string) {
  return Boolean(type && [
    'paragraph',
    'heading',
    'blockquote',
    'codeBlock',
    'listItem',
    'taskItem',
  ].includes(type));
}

function formatAssetName(node: RichNoteNode) {
  const name = typeof node.attrs?.name === 'string' ? node.attrs.name.trim() : '';
  return name ? `：${name}` : '';
}
