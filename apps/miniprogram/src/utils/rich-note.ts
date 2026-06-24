export interface RichNoteMark {
  type?: string;
  attrs?: Record<string, unknown>;
}

export interface RichNoteNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: RichNoteMark[];
  content?: RichNoteNode[];
}

export interface RichNotePayload {
  schemaVersion?: number;
  format?: 'tiptap';
  doc?: RichNoteNode;
  content?: string;
  updatedAt?: string;
}

interface EditorDeltaOp {
  insert?: string | { image?: string };
  attributes?: Record<string, unknown>;
}

interface EditorDelta {
  ops?: EditorDeltaOp[];
}

export const EMPTY_RICH_NOTE_DOC: RichNoteNode = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

export function normalizeRichNotePayload(value: unknown): RichNotePayload {
  if (typeof value === 'string') {
    return createRichNotePayload(plainTextToRichNoteDoc(value), value);
  }
  if (!value || typeof value !== 'object') {
    return createRichNotePayload(EMPTY_RICH_NOTE_DOC, '');
  }

  const payload = value as RichNotePayload;
  if (payload.doc?.type === 'doc') {
    return {
      ...payload,
      content: payload.content ?? richNoteToPlainText(payload),
    };
  }

  const content = payload.content ?? '';
  return createRichNotePayload(plainTextToRichNoteDoc(content), content);
}

export function createRichNotePayload(doc: RichNoteNode, plainText: string): RichNotePayload {
  return {
    schemaVersion: 2,
    format: 'tiptap',
    doc,
    content: plainText,
    updatedAt: new Date().toISOString(),
  };
}

export function editorDeltaToRichNotePayload(delta: EditorDelta | undefined, plainText: string) {
  const doc = editorDeltaToRichNoteDoc(delta, plainText);
  return createRichNotePayload(doc, plainText.trim());
}

export function plainTextToRichNotePayload(content: string): RichNotePayload {
  return createRichNotePayload(plainTextToRichNoteDoc(content), content);
}

export function plainTextToRichNoteDoc(value: string): RichNoteNode {
  const blocks = value
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!blocks.length) return EMPTY_RICH_NOTE_DOC;

  return {
    type: 'doc',
    content: blocks.map((line) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }],
    })),
  };
}

function editorDeltaToRichNoteDoc(delta: EditorDelta | undefined, fallbackText: string): RichNoteNode {
  const ops = delta?.ops ?? [];
  if (!ops.length) return plainTextToRichNoteDoc(fallbackText);

  const blocks: RichNoteNode[] = [];
  let inlineContent: RichNoteNode[] = [];
  let fallbackBuffer = '';

  function flushLine(attributes?: Record<string, unknown>) {
    const content = inlineContent.length ? inlineContent : undefined;
    const block = createBlockFromLine(content, attributes, fallbackBuffer);
    if (block) blocks.push(block);
    inlineContent = [];
    fallbackBuffer = '';
  }

  for (const op of ops) {
    if (typeof op.insert !== 'string') {
      const image = op.insert?.image;
      if (image) {
        inlineContent.push({
          type: 'text',
          text: '[图片]',
          marks: [{ type: 'bold' }],
        });
        fallbackBuffer += '[图片]';
      }
      continue;
    }

    const pieces = op.insert.split('\n');
    pieces.forEach((piece, index) => {
      if (piece) {
        inlineContent.push({
          type: 'text',
          text: piece,
          marks: attrsToMarks(op.attributes),
        });
        fallbackBuffer += piece;
      }
      if (index < pieces.length - 1) {
        flushLine(op.attributes);
      }
    });
  }

  if (inlineContent.length || fallbackBuffer.trim()) flushLine();

  return {
    type: 'doc',
    content: blocks.length ? blocks : [{ type: 'paragraph' }],
  };
}

function createBlockFromLine(
  content: RichNoteNode[] | undefined,
  attributes: Record<string, unknown> | undefined,
  fallbackText: string,
): RichNoteNode | undefined {
  const text = fallbackText.trim();
  if (!content && !text) return { type: 'paragraph' };

  if (attributes?.header) {
    return {
      type: 'heading',
      attrs: { level: Number(attributes.header) || 2 },
      content,
    };
  }
  if (attributes?.blockquote) {
    return { type: 'blockquote', content: [{ type: 'paragraph', content }] };
  }
  if (attributes?.['code-block']) {
    return { type: 'codeBlock', content: content ?? [{ type: 'text', text }] };
  }
  if (attributes?.list === 'ordered') {
    return { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content }] }] };
  }
  if (attributes?.list === 'bullet') {
    return { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content }] }] };
  }

  return { type: 'paragraph', content };
}

function attrsToMarks(attributes?: Record<string, unknown>): RichNoteMark[] | undefined {
  const marks: RichNoteMark[] = [];
  if (attributes?.bold) marks.push({ type: 'bold' });
  if (attributes?.italic) marks.push({ type: 'italic' });
  if (attributes?.underline) marks.push({ type: 'underline' });
  if (typeof attributes?.link === 'string') {
    marks.push({ type: 'link', attrs: { href: attributes.link } });
  }
  return marks.length ? marks : undefined;
}

export function richNoteToPlainText(payload: RichNotePayload) {
  const doc = payload.doc ?? plainTextToRichNoteDoc(payload.content ?? '');
  const parts: string[] = [];
  collectText(doc, parts);
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
}

export function richNoteToEditorHtml(payload: RichNotePayload) {
  const doc = payload.doc ?? plainTextToRichNoteDoc(payload.content ?? '');
  return renderNodeHtml(doc);
}

export function getRichNoteFeatureSummary(payload: RichNotePayload) {
  const features = new Set<string>();
  walkNodes(payload.doc, (node) => {
    const type = node.type ?? '';
    if (['table', 'tableRow', 'tableCell', 'tableHeader'].includes(type)) features.add('表格');
    if (type === 'codeBlock') features.add('代码块');
    if (type === 'encryptedImage') features.add('图片');
    if (type === 'encryptedVideo') features.add('视频');
    if (type === 'encryptedAttachment') features.add('附件');
  });
  return Array.from(features);
}

export function isMiniEditableRichNote(payload: RichNotePayload) {
  let editable = true;
  walkNodes(payload.doc, (node) => {
    if (['table', 'tableRow', 'tableCell', 'tableHeader', 'encryptedVideo', 'encryptedAttachment'].includes(node.type ?? '')) {
      editable = false;
    }
  });
  return editable;
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
  if (node.type === 'hardBreak') parts.push('\n');
  for (const child of node.content ?? []) collectText(child, parts);
  if (isBlockNode(node.type)) parts.push('\n');
}

function renderNodeHtml(node: RichNoteNode): string {
  const children = (node.content ?? []).map(renderNodeHtml).join('');
  switch (node.type) {
    case 'doc':
      return children || '<p></p>';
    case 'paragraph':
      return `<p>${children || '<br>'}</p>`;
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 1), 3);
      return `<h${level}>${children}</h${level}>`;
    }
    case 'blockquote':
      return `<blockquote>${children}</blockquote>`;
    case 'bulletList':
      return `<ul>${children}</ul>`;
    case 'orderedList':
      return `<ol>${children}</ol>`;
    case 'listItem':
      return `<li>${children}</li>`;
    case 'codeBlock':
      return `<pre><code>${children || escapeHtml(node.text ?? '')}</code></pre>`;
    case 'hardBreak':
      return '<br>';
    case 'encryptedImage':
      return `<p class="asset-block">[加密图片${escapeHtml(formatAssetName(node))}]</p>`;
    case 'encryptedVideo':
      return `<p class="asset-block">[加密视频${escapeHtml(formatAssetName(node))}]</p>`;
    case 'encryptedAttachment':
      return `<p class="asset-block">[加密附件${escapeHtml(formatAssetName(node))}]</p>`;
    case 'text':
      return renderMarkedText(node);
    default:
      return children || escapeHtml(node.text ?? '');
  }
}

function renderMarkedText(node: RichNoteNode) {
  let html = escapeHtml(node.text ?? '');
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') html = `<strong>${html}</strong>`;
    if (mark.type === 'italic') html = `<em>${html}</em>`;
    if (mark.type === 'underline') html = `<u>${html}</u>`;
    if (mark.type === 'link') {
      const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : '';
      html = `<a href="${escapeAttribute(href)}">${html}</a>`;
    }
  }
  return html;
}

function walkNodes(node: RichNoteNode | undefined, visit: (node: RichNoteNode) => void) {
  if (!node) return;
  visit(node);
  for (const child of node.content ?? []) walkNodes(child, visit);
}

function isBlockNode(type?: string) {
  return Boolean(type && ['paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem', 'taskItem'].includes(type));
}

function formatAssetName(node: RichNoteNode) {
  const name = typeof node.attrs?.name === 'string' ? node.attrs.name.trim() : '';
  return name ? `：${name}` : '';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
