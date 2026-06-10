<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getAuditActionLabel } from '@vaultpass/types';
import { listAdminSecurityAlerts } from '@/utils/services';

interface AlertRow {
  id: string;
  action: string;
  actionLabel: string;
  riskLevel: string;
  ip?: string;
  device?: string;
  userLabel: string;
  createdAt: string;
}

const alerts = ref<AlertRow[]>([]);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  try {
    const result = await listAdminSecurityAlerts();
    alerts.value = result.items.map((item) => ({
      id: item.id,
      action: item.action,
      actionLabel: getAuditActionLabel(item.action),
      riskLevel: item.riskLevel,
      ip: item.ip,
      device: item.device,
      userLabel: maskUser(item.user?.phone, item.user?.email, item.userId),
      createdAt: new Date(item.createdAt).toLocaleString(),
    }));
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
});

function maskUser(phone?: string, email?: string, userId?: string) {
  if (phone) return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  if (email) return email.replace(/(.{2}).+(@.+)/, '$1***$2');
  return userId ? `${userId.slice(0, 8)}...` : '未知用户';
}
</script>

<template>
  <section class="rounded-xl border border-slate-800 bg-slate-900 p-6">
    <h3 class="font-semibold text-white">安全告警</h3>
    <p class="mt-2 text-sm text-slate-400">高风险与严重级别审计事件（登录异常、敏感操作等）</p>

    <div v-if="loading" class="mt-6 text-slate-400">加载中...</div>
    <div v-else-if="alerts.length === 0" class="mt-6 text-slate-400">暂无告警</div>
    <ul v-else class="mt-4 divide-y divide-slate-800">
      <li v-for="item in alerts" :key="item.id" class="py-4 text-sm">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="font-medium text-amber-300">{{ item.actionLabel }}</p>
            <p class="mt-1 text-slate-400">{{ item.userLabel }}</p>
            <p class="mt-1 font-mono text-xs text-slate-500">
              IP {{ item.ip ?? '—' }}
              <span v-if="item.device"> · {{ item.device.slice(0, 60) }}</span>
            </p>
          </div>
          <span class="shrink-0 rounded-full bg-amber-900/50 px-2 py-1 text-xs text-amber-200">
            {{ item.riskLevel }}
          </span>
        </div>
        <p class="mt-2 text-xs text-slate-500">{{ item.createdAt }}</p>
      </li>
    </ul>
    <p v-if="error" class="mt-3 text-sm text-red-400">{{ error }}</p>
  </section>
</template>
