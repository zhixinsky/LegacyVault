<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getNotificationChannelLabel, getNotificationTypeLabel } from '@vaultpass/types';
import { listAdminNotificationLogs } from '@/utils/services';

const logs = ref<
  Array<{
    id: string;
    channel: string;
    notificationType: string;
    status: string;
    target?: string;
    createdAt: string;
    user: { phone?: string; email?: string };
  }>
>([]);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  try {
    const result = await listAdminNotificationLogs();
    logs.value = result.items;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="rounded-xl border border-slate-800 bg-slate-900 p-6">
    <h3 class="font-semibold text-white">短信/邮件发送日志</h3>
    <div v-if="loading" class="mt-6 text-slate-400">加载中...</div>
    <ul v-else class="mt-4 divide-y divide-slate-800">
      <li v-for="item in logs" :key="item.id" class="py-3 text-sm">
        <p class="text-white">
          {{ getNotificationChannelLabel(item.channel) }} ·
          {{ getNotificationTypeLabel(item.notificationType) }} ·
          {{ item.status }}
        </p>
        <p class="text-slate-400">
          用户 {{ item.user.phone || item.user.email || '未知' }} ·
          {{ item.target || '—' }} ·
          {{ new Date(item.createdAt).toLocaleString() }}
        </p>
      </li>
    </ul>
    <p v-if="error" class="mt-3 text-sm text-red-400">{{ error }}</p>
  </section>
</template>
