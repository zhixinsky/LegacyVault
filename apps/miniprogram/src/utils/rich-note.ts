export interface RichNoteNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: RichNoteNode[];
}

export interface RichNotePayload {
  schemaVersion?: number;
  format?: 'tiptap';
  doc?: RichNoteNode;
  content?: string;
}

export function richNoteToPlainText(payload: RichNotePayload) {
  if (payload.content) return payload.content;
  if (!payload.doc) return '';
  const parts: string[] = [];
  collectText(payload.doc, parts);
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
}

export function plainTextToRichNotePayload(content: string): RichNotePayload {
  return {
    schemaVersion: 2,
    format: 'tiptap',
    content,
    doc: {
      type: 'doc',
      content: content
        .split(/\n{2,}/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({
          type: 'paragraph',
          content: [{ type: 'text', text: line }],
        })),
    },
  };
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

  if (node.text) parts.push(node.text);
  for (const child of node.content ?? []) {
    collectText(child, parts);
  }
  if (['paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem', 'taskItem'].includes(node.type ?? '')) {
    parts.push('\n');
  }
}

function formatAssetName(node: RichNoteNode) {
  const name = typeof node.attrs?.name === 'string' ? node.attrs.name.trim() : '';
  return name ? `：${name}` : '';
}
