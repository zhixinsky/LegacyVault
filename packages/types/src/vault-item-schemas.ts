import type { VaultItemType } from './index';

export interface VaultItemFieldDef {
  key: string;
  label: string;
  sensitive?: boolean;
  inputType?: 'text' | 'password' | 'textarea';
  required?: boolean;
  placeholder?: string;
  listColumn?: boolean;
}

export interface VaultItemTypeConfig {
  type: VaultItemType;
  label: string;
  shortLabel: string;
  emoji: string;
  fields: VaultItemFieldDef[];
}

export const ACCOUNT_VAULT_TYPES = [
  'stock_account',
  'bank_account',
  'email_account',
  'server_account',
] as const satisfies readonly VaultItemType[];

export type AccountVaultType = (typeof ACCOUNT_VAULT_TYPES)[number];

export const VAULT_ITEM_TYPE_CONFIGS: Record<AccountVaultType, VaultItemTypeConfig> = {
  stock_account: {
    type: 'stock_account',
    label: '股票账户',
    shortLabel: '股票',
    emoji: '📈',
    fields: [
      { key: 'broker', label: '券商', listColumn: true, placeholder: '例如：华泰证券' },
      { key: 'accountNo', label: '资金账号', listColumn: true, required: true },
      { key: 'shareholderId', label: '股东代码' },
      { key: 'tradePassword', label: '交易密码', sensitive: true, required: true, inputType: 'password' },
      { key: 'fundPassword', label: '资金密码', sensitive: true, inputType: 'password' },
      { key: 'note', label: '备注', inputType: 'textarea' },
    ],
  },
  bank_account: {
    type: 'bank_account',
    label: '银行账户',
    shortLabel: '银行',
    emoji: '🏦',
    fields: [
      { key: 'bankName', label: '银行名称', listColumn: true, placeholder: '例如：工商银行' },
      { key: 'accountNo', label: '卡号/账号', listColumn: true, required: true },
      { key: 'holderName', label: '户名' },
      { key: 'branch', label: '开户行' },
      { key: 'phone', label: '预留手机' },
      { key: 'pin', label: '交易密码', sensitive: true, inputType: 'password' },
      { key: 'note', label: '备注', inputType: 'textarea' },
    ],
  },
  email_account: {
    type: 'email_account',
    label: '邮箱账户',
    shortLabel: '邮箱',
    emoji: '📧',
    fields: [
      { key: 'provider', label: '邮箱服务商', listColumn: true, placeholder: '例如：Gmail' },
      { key: 'address', label: '邮箱地址', listColumn: true, required: true },
      { key: 'password', label: '密码', sensitive: true, required: true, inputType: 'password' },
      { key: 'recoveryEmail', label: '备用邮箱' },
      { key: 'recoveryPhone', label: '备用手机' },
      { key: 'note', label: '备注', inputType: 'textarea' },
    ],
  },
  server_account: {
    type: 'server_account',
    label: '服务器账户',
    shortLabel: '服务器',
    emoji: '🖥️',
    fields: [
      { key: 'host', label: '主机/IP', listColumn: true, required: true, placeholder: '192.168.1.1' },
      { key: 'port', label: '端口', placeholder: '22' },
      { key: 'username', label: '用户名', listColumn: true, required: true },
      { key: 'password', label: '密码', sensitive: true, required: true, inputType: 'password' },
      { key: 'sshKey', label: 'SSH 密钥', sensitive: true, inputType: 'textarea' },
      { key: 'panelUrl', label: '面板地址' },
      { key: 'note', label: '备注', inputType: 'textarea' },
    ],
  },
};

export const CUSTOM_VAULT_TYPE = 'custom' as const satisfies VaultItemType;

export const CUSTOM_VAULT_CONFIG: VaultItemTypeConfig = {
  type: 'custom',
  label: '自定义私密信息',
  shortLabel: '自定义',
  emoji: '📋',
  fields: [
    { key: 'category', label: '分类', listColumn: true, placeholder: '例如：备忘、密钥' },
    { key: 'content', label: '内容', listColumn: true, required: true, inputType: 'textarea' },
    { key: 'secret', label: '敏感信息', sensitive: true, inputType: 'password' },
    { key: 'note', label: '备注', inputType: 'textarea' },
  ],
};

export const DOCUMENT_VAULT_TYPE = 'document' as const satisfies VaultItemType;

export const DOCUMENT_VAULT_CONFIG: VaultItemTypeConfig = {
  type: 'document',
  label: '证件与合同',
  shortLabel: '证件',
  emoji: '🪪',
  fields: [
    { key: 'docType', label: '类型', listColumn: true, placeholder: '身份证 / 护照 / 合同' },
    { key: 'number', label: '编号', listColumn: true, placeholder: '证件或合同编号' },
    { key: 'issuer', label: '签发/保管方', placeholder: '签发机关或签约方' },
    { key: 'validUntil', label: '有效期', placeholder: '例如 2030-12-31' },
    { key: 'secret', label: '敏感信息', sensitive: true, inputType: 'textarea' },
    { key: 'note', label: '备注', inputType: 'textarea' },
  ],
};

export const MANAGED_VAULT_TYPES = [
  ...ACCOUNT_VAULT_TYPES,
  DOCUMENT_VAULT_TYPE,
  CUSTOM_VAULT_TYPE,
] as const;

export type ManagedVaultType = (typeof MANAGED_VAULT_TYPES)[number];

export function isAccountVaultType(type: string): type is AccountVaultType {
  return (ACCOUNT_VAULT_TYPES as readonly string[]).includes(type);
}

export function isManagedVaultType(type: string): type is ManagedVaultType {
  return (MANAGED_VAULT_TYPES as readonly string[]).includes(type);
}

export function getVaultItemTypeConfig(type: string): VaultItemTypeConfig | undefined {
  if (isAccountVaultType(type)) return VAULT_ITEM_TYPE_CONFIGS[type];
  if (type === DOCUMENT_VAULT_TYPE) return DOCUMENT_VAULT_CONFIG;
  if (type === CUSTOM_VAULT_TYPE) return CUSTOM_VAULT_CONFIG;
  return undefined;
}

export function listManagedVaultConfigs(): VaultItemTypeConfig[] {
  return [
    ...ACCOUNT_VAULT_TYPES.map((type) => VAULT_ITEM_TYPE_CONFIGS[type]),
    DOCUMENT_VAULT_CONFIG,
    CUSTOM_VAULT_CONFIG,
  ];
}
