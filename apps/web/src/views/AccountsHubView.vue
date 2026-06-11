<script setup lang="ts">
import { useRouter } from 'vue-router';
import { listManagedVaultConfigs } from '@vaultpass/types';

const router = useRouter();

const cards = listManagedVaultConfigs();
</script>

<template>
  <div class="space-y-6">
    <p class="text-sm text-slate-500">
      管理股票、银行、邮箱、服务器、证件与合同等敏感信息，均在本地加密后同步。
    </p>

    <div class="grid gap-4 sm:grid-cols-2">
      <button
        v-for="card in cards"
        :key="card.type"
        class="rounded-2xl bg-gradient-to-br from-white via-blue-50/50 to-emerald-50/40 p-6 text-left shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:bg-blue-50 hover:shadow-md hover:ring-blue-200"
        @click="router.push(`/app/accounts/${card.type}`)"
      >
        <span class="text-3xl">{{ card.emoji }}</span>
        <h3 class="mt-3 text-lg font-semibold text-slate-900">{{ card.label }}</h3>
        <p class="mt-1 text-sm text-slate-500">查看与管理{{ card.shortLabel }}账户</p>
      </button>
    </div>
  </div>
</template>
