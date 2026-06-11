<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getAuditActionLabel } from '@vaultpass/types';
import { listAdminAuditLogs } from '@/utils/services';

const logs = ref<
  Array<{
    id: string;
    actionLabel: string;
    actorType: string;
    riskLevel: string;
    ip?: string;
    userLabel: string;
    createdAt: string;
  }>
>([]);
const loading = ref(true);
const error = ref('');
const riskFilter = ref('');

onMounted(() => loadLogs());

async function loadLogs() {
  loading.value = true;
  error.value = '';
  try {
    const result = await listAdminAuditLogs(1, riskFilter.value || undefined);
    logs.value = result.items.map((item) => ({
      id: item.id,
      actionLabel: getAuditActionLabel(item.action),
      actorType: item.actorType,
      riskLevel: item.riskLevel,
      ip: item.ip,
      userLabel: maskUser(item.user?.phone, item.user?.email, item.userId),
      createdAt: new Date(item.createdAt).toLocaleString(),
    }));
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

function maskUser(phone?: string, email?: string, userId?: string) {
  if (phone) return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  if (email) return email.replace(/(.{2}).+(@.+)/, '$1***$2');
  return userId ? `${userId.slice(0, 8)}...` : '—';
}
</script>

<template>
  <section class="rounded-[22px] border border-slate-100 bg-white p-6 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="font-semibold text-slate-950">审计日志</h3>
      <select
        v-model="riskFilter"
        class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
        @change="loadLogs"
      >
        <option value="">全部风险等级</option>
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
        <option value="critical">critical</option>
      </select>
    </div>

    <div v-if="loading" class="mt-6 text-slate-500">加载中...</div>
    <ul v-else class="mt-4 divide-y divide-slate-100">
      <li v-for="item in logs" :key="item.id" class="py-3 text-sm">
        <p class="font-medium text-slate-950">{{ item.actionLabel }}</p>
        <p class="text-slate-500">
          {{ item.userLabel }} · {{ item.actorType }} · {{ item.riskLevel }}
          <span v-if="item.ip"> · IP {{ item.ip }}</span>
        </p>
        <p class="text-xs text-slate-400">{{ item.createdAt }}</p>
      </li>
    </ul>
    <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
  </section>
</template>
