<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { getAuditActionLabel, isLoginAuditAction } from '@vaultpass/types';
import { listAuditLogs } from '@/utils/services';

const logs = ref<
  Array<{
    id: string;
    actionLabel: string;
    riskLevel: string;
    ip?: string;
    time: string;
    alert: boolean;
  }>
>([]);
const loading = ref(false);

onShow(loadLogs);

async function loadLogs() {
  loading.value = true;
  try {
    const result = await listAuditLogs();
    logs.value = result.items
      .filter((item) => isLoginAuditAction(item.action))
      .map((item) => ({
        id: item.id,
        actionLabel: getAuditActionLabel(item.action),
        riskLevel: item.riskLevel,
        ip: item.ip,
        time: formatTime(item.createdAt),
        alert:
          item.action === 'auth.login.failed' ||
          item.action === 'auth.login.new_ip' ||
          item.action === 'auth.new_device' ||
          item.action === 'auth.login.blocked_ip',
      }));
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

function formatTime(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">登录记录</text>
      <text class="subtitle">登录成功、失败、新设备与异地 IP 等安全事件</text>

      <view v-if="loading" class="hint">加载中...</view>
      <view v-else-if="logs.length === 0" class="hint">暂无登录记录</view>
      <view v-else>
        <view
          v-for="log in logs"
          :key="log.id"
          class="list-item column"
          :class="{ alert: log.alert }"
        >
          <text class="item-title">{{ log.actionLabel }}</text>
          <text class="item-meta">IP：{{ log.ip ?? '—' }} · {{ log.time }}</text>
          <text class="badge" :class="{ 'badge-alert': log.alert }">{{ log.riskLevel }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.column {
  flex-direction: column;
  align-items: flex-start;
  gap: 8rpx;
}

.item-title {
  font-weight: 600;
}

.item-meta {
  font-size: 24rpx;
  color: #64748b;
}

.alert {
  background: #fffbeb;
}

.badge-alert {
  background: #fde68a;
  color: #92400e;
}
</style>
