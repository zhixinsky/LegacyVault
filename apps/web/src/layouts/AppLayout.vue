<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { API_BASE_URL } from '@/config';
import { vaultSession } from '@/utils/api';

const route = useRoute();
const router = useRouter();
const headerQuery = ref('');
const appLogoFileId =
  'cloud://prod-d4g8kpg7x92d55205.7072-prod-d4g8kpg7x92d55205-1441616383/img/logo.webp';
const appLogoUrl = new URL(`${API_BASE_URL}/files/cloud-image`, window.location.origin);
appLogoUrl.searchParams.set('fileId', appLogoFileId);

const navGroups = [
  {
    title: '总览',
    items: [{ icon: '⌂', label: '控制台', to: '/app/dashboard' }],
  },
  {
    title: '保险箱内容',
    items: [
      { icon: '▣', label: '账号密码', to: '/app/passwords' },
      { icon: '◆', label: '敏感账户', to: '/app/accounts' },
      { icon: '✎', label: '私密笔记', to: '/app/notes' },
      { icon: '▤', label: '文件管理', to: '/app/files' },
      { icon: '◫', label: '相册管理', to: '/app/albums' },
    ],
  },
  {
    title: '关系与继承',
    items: [
      { icon: '◇', label: '安全联系人', to: '/app/contacts' },
      { icon: '⧉', label: '数字遗产', to: '/app/inheritance' },
    ],
  },
  {
    title: '安全与账户',
    items: [
      { icon: '◉', label: '个人资料', to: '/app/profile' },
      { icon: '◈', label: '安全中心', to: '/app/security' },
      { icon: '◷', label: '登录记录', to: '/app/login-history' },
      { icon: '≡', label: '审计日志', to: '/app/audit-logs' },
    ],
  },
  {
    title: '工具',
    items: [
      { icon: '↺', label: '回收站', to: '/app/recycle-bin' },
      { icon: '⇩', label: '数据导出', to: '/app/export' },
    ],
  },
];

const navItems = navGroups.flatMap((group) => group.items);

const pageTitle = computed(() => {
  if (route.path.startsWith('/app/search')) return '搜索';
  return navItems.find((item) => route.path.startsWith(item.to))?.label ?? 'VaultPass';
});

function lockVault() {
  vaultSession.clearVaultKey();
  router.push('/unlock');
}

function logout() {
  vaultSession.logout();
  router.push('/login');
}

function submitHeaderSearch() {
  const query = headerQuery.value.trim();
  router.push({ path: '/app/search', query: query ? { q: query } : {} });
}
</script>

<template>
  <div class="flex min-h-screen gap-6 bg-[linear-gradient(135deg,#eef7ff_0%,#f8fbff_42%,#eefcf7_100%)] p-6">
    <aside class="flex w-72 shrink-0 flex-col rounded-[24px] border border-white/70 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
      <div class="border-b border-slate-100 px-6 py-5">
        <div class="flex items-center gap-3">
          <img
            class="h-11 w-11 rounded-2xl object-cover shadow-lg shadow-blue-200"
            :src="appLogoUrl.toString()"
            alt="VaultPass"
          />
          <div>
            <p class="font-semibold text-slate-900">VaultPass</p>
            <p class="text-xs text-slate-500">零知识保险箱</p>
          </div>
        </div>
      </div>

      <nav class="flex-1 space-y-5 overflow-auto p-4">
        <section v-for="group in navGroups" :key="group.title" class="rounded-2xl bg-gradient-to-br from-blue-50/80 via-white to-emerald-50/60 p-2">
          <p class="px-3 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{{ group.title }}</p>
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-blue-700 hover:shadow-sm"
            :class="{ 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-100': route.path.startsWith(item.to) }"
          >
            <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </RouterLink>
        </section>
      </nav>

      <div class="space-y-2 border-t border-slate-100 p-4">
        <VButton variant="secondary" class="w-full" @click="lockVault">锁定保险箱</VButton>
        <VButton variant="secondary" class="w-full" @click="logout">退出登录</VButton>
      </div>
    </aside>

    <main class="min-w-0 flex-1 overflow-auto rounded-[28px] border border-white/70 bg-gradient-to-br from-white/88 via-blue-50/55 to-emerald-50/45">
      <header class="m-4 rounded-[22px] border border-white bg-white/90 px-6 py-5 shadow-sm backdrop-blur">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">{{ pageTitle }}</h1>
            <p class="mt-1 text-sm text-slate-500">所有敏感数据均在本地解密，服务器无法查看明文</p>
          </div>
          <form class="flex w-full max-w-md gap-2 sm:w-auto" @submit.prevent="submitHeaderSearch">
            <input
              v-model="headerQuery"
              class="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white"
              placeholder="搜索保险箱..."
            />
            <VButton type="submit" variant="secondary">搜索</VButton>
          </form>
        </div>
      </header>
      <div class="p-4 pt-0">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
.w-full {
  width: 100%;
}
</style>
