<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { VButton } from '@vaultpass/ui';
import { getAdminStats, runInheritanceScan } from '@/utils/services';

const stats = ref({ users: 0, activeEvents: 0, highRiskToday: 0 });
const loading = ref(true);
const scanning = ref(false);
const message = ref('');
const error = ref('');

onMounted(async () => {
  try {
    stats.value = await getAdminStats();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
});

async function handleScan() {
  scanning.value = true;
  message.value = '';
  error.value = '';
  try {
    const result = await runInheritanceScan();
    message.value = `扫描完成：${result.scanned} 用户，${result.processed} 条动作`;
    stats.value = await getAdminStats();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '扫描失败';
  } finally {
    scanning.value = false;
  }
}
</script>

<template>
  <section class="grid gap-4 md:grid-cols-3">
    <article class="rounded-[22px] border border-slate-100 bg-white p-6 shadow-sm">
      <p class="text-sm text-slate-500">注册用户</p>
      <p class="mt-2 text-3xl font-bold text-slate-950">{{ loading ? '—' : stats.users }}</p>
    </article>
    <article class="rounded-[22px] border border-slate-100 bg-white p-6 shadow-sm">
      <p class="text-sm text-slate-500">进行中交接事件</p>
      <p class="mt-2 text-3xl font-bold text-slate-950">{{ loading ? '—' : stats.activeEvents }}</p>
    </article>
    <article class="rounded-[22px] border border-amber-100 bg-white p-6 shadow-sm">
      <p class="text-sm text-slate-500">今日高风险操作</p>
      <p class="mt-2 text-3xl font-bold text-amber-600">{{ loading ? '—' : stats.highRiskToday }}</p>
      <router-link to="/security-alerts" class="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline">
        查看安全告警 →
      </router-link>
    </article>
  </section>

  <section class="mt-5 rounded-[22px] border border-slate-100 bg-white p-6 shadow-sm">
    <h3 class="font-semibold text-slate-950">数字遗产扫描</h3>
    <p class="mt-2 text-sm text-slate-500">手动触发 inactive 用户扫描与交接流程推进</p>
    <VButton class="mt-4" variant="primary" :disabled="scanning" @click="handleScan">
      {{ scanning ? '扫描中...' : '立即扫描' }}
    </VButton>
    <p v-if="message" class="mt-3 text-sm text-emerald-600">{{ message }}</p>
    <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
  </section>
</template>
