<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { listAdminInheritanceEvents } from '@/utils/services';

const events = ref<
  Array<{
    id: string;
    status: string;
    currentStage: string;
    triggerAt: string;
    user: { phone?: string; email?: string };
  }>
>([]);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  try {
    const result = await listAdminInheritanceEvents();
    events.value = result.items;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="rounded-xl border border-slate-800 bg-slate-900 p-6">
    <h3 class="font-semibold text-white">交接事件</h3>
    <div v-if="loading" class="mt-6 text-slate-400">加载中...</div>
    <ul v-else class="mt-4 divide-y divide-slate-800">
      <li v-for="item in events" :key="item.id" class="py-3 text-sm">
        <p class="text-white">{{ item.status }} · {{ item.currentStage }}</p>
        <p class="text-slate-400">
          用户 {{ item.user.phone || item.user.email || '未知' }} ·
          {{ new Date(item.triggerAt).toLocaleString() }}
        </p>
      </li>
    </ul>
    <p v-if="error" class="mt-3 text-sm text-red-400">{{ error }}</p>
  </section>
</template>
