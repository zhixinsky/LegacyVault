<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { clearAdminKey } from '@/utils/api';

const route = useRoute();
const router = useRouter();

const navGroups = [
  {
    title: '运营总览',
    items: [{ icon: '⌂', label: '控制台', to: '/' }],
  },
  {
    title: '用户与交接',
    items: [
      { icon: '◉', label: '用户管理', to: '/users' },
      { icon: '⧉', label: '交接事件', to: '/inheritance-events' },
    ],
  },
  {
    title: '安全风控',
    items: [
      { icon: '◈', label: '安全告警', to: '/security-alerts' },
      { icon: '⊘', label: 'IP 黑名单', to: '/ip-blacklist' },
    ],
  },
  {
    title: '日志审计',
    items: [
      { icon: '≡', label: '审计日志', to: '/audit-logs' },
      { icon: '✉', label: '通知日志', to: '/notification-logs' },
    ],
  },
];

const navItems = navGroups.flatMap((group) => group.items);

const pageTitle = computed(() => {
  return navItems.find((item) => item.to === route.path)?.label ?? 'VaultPass Admin';
});

function logout() {
  clearAdminKey();
  router.push('/login');
}
</script>

<template>
  <div class="min-h-screen bg-[#f4f7fb] p-6 text-slate-900">
    <aside class="fixed inset-y-6 left-6 flex w-72 flex-col rounded-[26px] border border-white bg-white p-5 shadow-[0_22px_60px_rgba(15,23,42,0.09)]">
      <div class="rounded-3xl bg-slate-950 p-5 text-white">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500 font-bold">A</div>
          <div>
            <h1 class="text-lg font-semibold">VaultPass Admin</h1>
            <p class="mt-1 text-xs text-slate-300">零知识架构 · 不可查看明文</p>
          </div>
        </div>
      </div>

      <nav class="mt-5 flex-1 space-y-5 overflow-auto text-sm">
        <section v-for="group in navGroups" :key="group.title" class="rounded-2xl bg-slate-50 p-2">
          <p class="px-3 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{{ group.title }}</p>
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-slate-600 transition hover:bg-white hover:text-blue-700 hover:shadow-sm"
            :class="{ 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100': route.path === item.to }"
          >
            <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </RouterLink>
        </section>
      </nav>
    </aside>

    <main class="ml-80 min-h-[calc(100vh-48px)] rounded-[30px] border border-white/80 bg-white/75 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
      <header class="mb-5 flex items-center justify-between rounded-[24px] border border-white bg-white px-6 py-5 shadow-sm">
        <div>
          <h2 class="text-2xl font-bold text-slate-950">{{ pageTitle }}</h2>
          <p class="text-sm text-slate-500">后台仅管理平台状态，无法解密用户数据</p>
        </div>
        <VButton variant="secondary" @click="logout">退出登录</VButton>
      </header>
      <RouterView />
    </main>
  </div>
</template>
