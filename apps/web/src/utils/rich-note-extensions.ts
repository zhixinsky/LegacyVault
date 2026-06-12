import { mergeAttributes, Node } from '@tiptap/core';

export interface EncryptedAssetAttrs {
  fileId: string;
  encryptedFileKey: string;
  mimeType: string;
  name: string;
  size: number;
  src?: string;
}

const assetAttrs = {
  fileId: { default: '' },
  encryptedFileKey: { default: '' },
  mimeType: { default: '' },
  name: { default: '' },
  size: { default: 0 },
  src: { default: '' },
};

export const EncryptedImage = Node.create({
  name: 'encryptedImage',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return assetAttrs;
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="encrypted-image"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const name = String(HTMLAttributes.name || '加密图片');
    const src = String(HTMLAttributes.src || '');
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'encrypted-image',
        'data-file-id': String(HTMLAttributes.fileId || ''),
        class: 'encrypted-image-node',
      }),
      src
        ? ['img', { src, alt: name }]
        : ['div', { class: 'encrypted-image-placeholder' }, '图片已加密，打开笔记时本地解密预览'],
      ['figcaption', {}, name],
    ];
  },
});

export const EncryptedVideo = Node.create({
  name: 'encryptedVideo',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return assetAttrs;
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="encrypted-video"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const name = String(HTMLAttributes.name || '加密视频');
    const src = String(HTMLAttributes.src || '');
    const mimeType = String(HTMLAttributes.mimeType || 'video/mp4');
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'encrypted-video',
        'data-file-id': String(HTMLAttributes.fileId || ''),
        class: 'encrypted-video-node',
      }),
      src
        ? ['video', { src, controls: 'true', preload: 'metadata', type: mimeType }]
        : ['div', { class: 'encrypted-video-placeholder' }, '视频已加密，打开笔记时本地解密播放'],
      ['figcaption', {}, name],
    ];
  },
});

export const EncryptedAttachment = Node.create({
  name: 'encryptedAttachment',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return assetAttrs;
  },

  parseHTML() {
    return [{ tag: 'div[data-type="encrypted-attachment"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const fileId = String(HTMLAttributes.fileId || '');
    const name = String(HTMLAttributes.name || '加密附件');
    const size = Number(HTMLAttributes.size || 0);
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'encrypted-attachment',
        'data-file-id': fileId,
        'data-encrypted-file-key': String(HTMLAttributes.encryptedFileKey || ''),
        'data-mime-type': String(HTMLAttributes.mimeType || ''),
        'data-name': name,
        'data-size': String(size),
        class: 'encrypted-attachment-node',
      }),
      ['div', { class: 'attachment-icon' }, 'FILE'],
      [
        'div',
        { class: 'attachment-body' },
        ['strong', {}, name],
        ['span', {}, formatSize(size)],
      ],
      [
        'button',
        {
          type: 'button',
          class: 'attachment-download',
          'data-download-file-id': fileId,
        },
        '下载解密',
      ],
    ];
  },
});

function formatSize(size: number) {
  if (!size) return '未知大小';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
