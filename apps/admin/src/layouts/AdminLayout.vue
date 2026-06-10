<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { clearAdminKey } from '@/utils/api';

const route = useRoute();
const router = useRouter();

const navItems = [
  { label: '控制台', to: '/' },
  { label: '用户管理', to: '/users' },
  { label: '交接事件', to: '/inheritance-events' },
  { label: '安全告警', to: '/security-alerts' },
  { label: 'IP 黑名单', to: '/ip-blacklist' },
  { label: '审计日志', to: '/audit-logs' },
  { label: '通知日志', to: '/notification-logs' },
];

const pageTitle = computed(() => {
  return navItems.find((item) => item.to === route.path)?.label ?? 'VaultPass Admin';
});

function logout() {
  clearAdminKey();
  router.push('/login');
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <aside class="fixed inset-y-0 w-64 border-r border-slate-800 bg-slate-950 p-6">
      <h1 class="text-lg font-semibold text-white">VaultPass Admin</h1>
      <p class="mt-1 text-xs text-slate-400">零知识架构 · 不可查看用户明文</p>
      <nav class="mt-8 space-y-2 text-sm text-slate-300">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="block rounded-lg px-3 py-2 transition hover:bg-slate-900"
          :class="{ 'bg-slate-800 text-white': route.path === item.to }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <main class="ml-64 p-8">
      <header class="mb-8 flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-white">{{ pageTitle }}</h2>
          <p class="text-sm text-slate-400">后台仅管理平台状态，无法解密用户数据</p>
        </div>
        <VButton variant="secondary" @click="logout">退出登录</VButton>
      </header>
      <RouterView />
    </main>
  </div>
</template>
