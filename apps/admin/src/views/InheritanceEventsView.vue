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
  <section class="rounded-[22px] border border-slate-100 bg-white p-6 shadow-sm">
    <h3 class="font-semibold text-slate-950">交接事件</h3>
    <div v-if="loading" class="mt-6 text-slate-500">加载中...</div>
    <ul v-else class="mt-4 divide-y divide-slate-100">
      <li v-for="item in events" :key="item.id" class="py-3 text-sm">
        <p class="font-medium text-slate-950">{{ item.status }} · {{ item.currentStage }}</p>
        <p class="text-slate-500">
          用户 {{ item.user.phone || item.user.email || '未知' }} ·
          {{ new Date(item.triggerAt).toLocaleString() }}
        </p>
      </li>
    </ul>
    <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
  </section>
</template>
