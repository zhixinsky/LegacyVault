<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { vaultSession } from '@/utils/api';

const route = useRoute();
const router = useRouter();
const headerQuery = ref('');

const navItems = [
  { label: '搜索', to: '/app/search' },
  { label: '控制台', to: '/app/dashboard' },
  { label: '账号密码', to: '/app/passwords' },
  { label: '敏感账户', to: '/app/accounts' },
  { label: '私密笔记', to: '/app/notes' },
  { label: '文件管理', to: '/app/files' },
  { label: '相册管理', to: '/app/albums' },
  { label: '安全联系人', to: '/app/contacts' },
  { label: '数字遗产', to: '/app/inheritance' },
  { label: '个人资料', to: '/app/profile' },
  { label: '安全中心', to: '/app/security' },
  { label: '登录记录', to: '/app/login-history' },
  { label: '审计日志', to: '/app/audit-logs' },
  { label: '回收站', to: '/app/recycle-bin' },
  { label: '数据导出', to: '/app/export' },
];

const pageTitle = computed(() => {
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
  <div class="flex min-h-screen bg-slate-100">
    <aside class="flex w-64 flex-col border-r border-slate-200 bg-white">
      <div class="border-b border-slate-200 px-6 py-5">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
            VP
          </div>
          <div>
            <p class="font-semibold text-slate-900">VaultPass</p>
            <p class="text-xs text-slate-500">零知识保险箱</p>
          </div>
        </div>
      </div>

      <nav class="flex-1 space-y-1 p-4">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="block rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
          :class="{ 'bg-blue-50 font-medium text-blue-700': route.path.startsWith(item.to) }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="space-y-2 border-t border-slate-200 p-4">
        <VButton variant="secondary" class="w-full" @click="lockVault">锁定保险箱</VButton>
        <VButton variant="secondary" class="w-full" @click="logout">退出登录</VButton>
      </div>
    </aside>

    <main class="flex-1 overflow-auto">
      <header class="border-b border-slate-200 bg-white px-8 py-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">{{ pageTitle }}</h1>
            <p class="mt-1 text-sm text-slate-500">所有敏感数据均在本地解密，服务器无法查看明文</p>
          </div>
          <form class="flex w-full max-w-md gap-2 sm:w-auto" @submit.prevent="submitHeaderSearch">
            <input
              v-model="headerQuery"
              class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="搜索保险箱..."
            />
            <VButton type="submit" variant="secondary">搜索</VButton>
          </form>
        </div>
      </header>
      <div class="p-8">
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
