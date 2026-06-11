<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getToken, vaultSession } from '@/utils/api';

const router = useRouter();

onMounted(() => {
  const token = getToken();
  if (!token) return;

  if (vaultSession.getVaultKey()) {
    router.replace('/app/dashboard');
    return;
  }

  router.replace('/unlock');
});
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            VP
          </div>
          <div>
            <h1 class="text-lg font-semibold text-slate-900">VaultPass</h1>
            <p class="text-sm text-slate-500">零知识加密数字资产保险箱</p>
          </div>
        </div>
        <RouterLink
          to="/login"
          class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"
        >
          登录
        </RouterLink>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-6 py-16">
      <section class="rounded-2xl bg-white p-10 shadow-sm ring-1 ring-slate-200">
        <h2 class="text-3xl font-bold text-slate-900">你的私密信息，只有你能解密</h2>
        <p class="mt-4 max-w-2xl text-slate-600">
          账号密码、证件资料、私密相册与文件，全部在本地加密后上传。服务器与开发者均无法查看明文内容。
        </p>
        <div class="mt-8 flex gap-4">
          <RouterLink
            to="/login"
            class="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700"
          >
            开始使用
          </RouterLink>
        </div>
      </section>

      <section class="mt-8 grid gap-4 md:grid-cols-3">
        <article class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
          <h3 class="font-semibold text-slate-900">零知识加密</h3>
          <p class="mt-2 text-sm text-slate-600">主密码永不离开你的设备，所有数据客户端加密。</p>
        </article>
        <article class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
          <h3 class="font-semibold text-slate-900">安全联系人</h3>
          <p class="mt-2 text-sm text-slate-600">预设 trusted contact，在意外情况下按规则交接。</p>
        </article>
        <article class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
          <h3 class="font-semibold text-slate-900">多端同步</h3>
          <p class="mt-2 text-sm text-slate-600">支持 PC Web 与微信小程序，密文安全同步。</p>
        </article>
      </section>
    </main>
  </div>
</template>
