<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import {
  getVaultItemTypeConfig,
  isManagedVaultType,
  type VaultItemFieldDef,
} from '@vaultpass/types';
import { decryptVaultPayload, decryptVaultTitle } from '@/utils/crypto-flow';
import {
  deleteVaultItem,
  getProfile,
  listVaultItems,
  revealVaultPassword,
  type VaultItem,
} from '@/utils/services';

const vaultType = ref('');
const config = computed(() => getVaultItemTypeConfig(vaultType.value));
const listFields = computed(() => config.value?.fields.filter((f) => f.listColumn) ?? []);
const sensitiveFields = computed(() => config.value?.fields.filter((f) => f.sensitive) ?? []);

const items = ref<Array<{ id: string; title: string; summary: string; encryptedPayload: string }>>([]);
const loading = ref(false);
const mfaEnabled = ref(false);
const revealItem = ref<{ id: string; title: string; encryptedPayload: string } | null>(null);
const revealMfaCode = ref('');
const revealedValues = ref<Record<string, string>>({});

onLoad((query) => {
  const type = String(query?.type ?? '');
  if (!isManagedVaultType(type)) {
    uni.redirectTo({ url: '/pages/accounts-hub/accounts-hub' });
    return;
  }
  vaultType.value = type;
  uni.setNavigationBarTitle({ title: getVaultItemTypeConfig(type)?.label ?? '敏感账户' });
});

onShow(async () => {
  if (!vaultType.value) return;
  try {
    const profile = await getProfile();
    mfaEnabled.value = profile.mfaEnabled;
  } catch {
    // ignore
  }
  await loadItems();
});

async function loadItems() {
  if (!config.value) return;
  loading.value = true;
  try {
    const result = await listVaultItems(vaultType.value);
    const rows = [];
    for (const item of result.items) {
      rows.push(await parseItem(item, listFields.value));
    }
    items.value = rows;
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

async function parseItem(item: VaultItem, fields: VaultItemFieldDef[]) {
  try {
    const title = await decryptVaultTitle(item.titleCiphertext);
    const payload = await decryptVaultPayload<Record<string, string>>(item.encryptedPayload);
    const summary = fields.map((f) => `${f.label}: ${payload[f.key] ?? '-'}`).join(' · ');
    return { id: item.id, title, summary, encryptedPayload: item.encryptedPayload };
  } catch {
    return { id: item.id, title: '解密失败', summary: '', encryptedPayload: item.encryptedPayload };
  }
}

function openCreate() {
  uni.navigateTo({ url: `/pages/account-create/account-create?type=${vaultType.value}` });
}

function openReveal(item: { id: string; title: string; encryptedPayload: string }) {
  revealItem.value = item;
  revealMfaCode.value = '';
  revealedValues.value = {};
}

async function handleReveal() {
  if (!revealItem.value) return;
  try {
    await revealVaultPassword(revealItem.value.id, revealMfaCode.value || undefined);
    const payload = await decryptVaultPayload<Record<string, string>>(revealItem.value.encryptedPayload);
    const values: Record<string, string> = {};
    for (const field of sensitiveFields.value) {
      values[field.key] = payload[field.key] ?? '（未设置）';
    }
    revealedValues.value = values;
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '查看失败',
      icon: 'none',
    });
  }
}

function closeReveal() {
  revealItem.value = null;
  revealedValues.value = {};
}

async function handleDelete(id: string) {
  uni.showModal({
    title: '确认删除',
    content: '确定删除该条目？将移入回收站',
    success: async (res) => {
      if (!res.confirm) return;
      await deleteVaultItem(id);
      await loadItems();
    },
  });
}
</script>

<template>
  <view class="container">
    <view class="card">
      <view class="section-header">
        <text class="section-title">{{ config?.label ?? '敏感账户' }}</text>
        <text class="link" @tap="openCreate">新增</text>
      </view>

      <view v-if="loading" class="empty">加载中...</view>
      <view v-else-if="items.length === 0" class="empty">暂无数据，点击新增</view>
      <view v-else>
        <view v-for="item in items" :key="item.id" class="list-item column">
          <view>
            <text class="item-title">{{ item.title }}</text>
            <text class="item-summary">{{ item.summary }}</text>
          </view>
          <view class="actions">
            <text class="link" @tap="openReveal(item)">查看敏感信息</text>
            <text class="danger" @tap="handleDelete(item.id)">删除</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="revealItem" class="modal-mask" @tap="closeReveal">
      <view class="modal-card" @tap.stop>
        <text class="modal-title">敏感信息 · {{ revealItem.title }}</text>
        <input
          v-if="!Object.keys(revealedValues).length"
          v-model="revealMfaCode"
          class="input"
          placeholder="二次验证码（未启用可留空）"
        />
        <view v-for="field in sensitiveFields" :key="field.key">
          <text v-if="Object.keys(revealedValues).length" class="field-label">{{ field.label }}</text>
          <text v-if="revealedValues[field.key]" class="reveal-value">{{ revealedValues[field.key] }}</text>
        </view>
        <button
          v-if="!Object.keys(revealedValues).length"
          class="btn btn-primary"
          @tap="handleReveal"
        >
          确认查看
        </button>
        <button class="btn btn-secondary" @tap="closeReveal">关闭</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
}

.link {
  color: #2563eb;
  font-size: 24rpx;
}

.danger {
  color: #dc2626;
  font-size: 24rpx;
  margin-left: 24rpx;
}

.column {
  flex-direction: column;
  align-items: flex-start;
  gap: 16rpx;
}

.item-title {
  display: block;
  font-weight: 600;
}

.item-summary {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #64748b;
}

.actions {
  width: 100%;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
}

.modal-card {
  width: 100%;
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
}

.modal-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
}

.reveal-value {
  display: block;
  margin-top: 8rpx;
  padding: 16rpx;
  background: #f8fafc;
  border-radius: 12rpx;
  font-size: 24rpx;
  word-break: break-all;
}

.btn-secondary {
  margin-top: 16rpx;
  background: #fff;
  color: #334155;
  border: 1rpx solid #cbd5e1;
}
</style>
