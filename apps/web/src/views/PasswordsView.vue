<script setup lang="ts">

import { onMounted, ref } from 'vue';

import { useRouter } from 'vue-router';

import { VButton } from '@vaultpass/ui';

import { decryptVaultPayload, decryptVaultTitle } from '@/utils/crypto-flow';

import {

  deleteVaultItem,

  getProfile,

  listVaultItems,

  revealVaultPassword,

  type VaultItem,

} from '@/utils/services';



interface PasswordRow {

  id: string;

  title: string;

  platform: string;

  username: string;

  encryptedPayload: string;

}



const router = useRouter();

const items = ref<PasswordRow[]>([]);

const loading = ref(true);

const mfaEnabled = ref(false);

const error = ref('');

const revealTarget = ref<PasswordRow | null>(null);

const revealMfaCode = ref('');

const revealedPassword = ref('');

const revealing = ref(false);



onMounted(async () => {

  try {

    const profile = await getProfile();

    mfaEnabled.value = profile.mfaEnabled;

  } catch {

    // ignore

  }

  await loadItems();

});



async function loadItems() {

  loading.value = true;

  error.value = '';

  try {

    const [emailResult, serverResult] = await Promise.all([
      listVaultItems('email_account'),
      listVaultItems('server_account'),
    ]);

    const rows: PasswordRow[] = [];



    for (const item of [...emailResult.items, ...serverResult.items]) {

      rows.push(await parseItem(item));

    }



    items.value = rows;

  } catch (err) {

    error.value = err instanceof Error ? err.message : '加载失败';

  } finally {

    loading.value = false;

  }

}



async function parseItem(item: VaultItem): Promise<PasswordRow> {

  try {

    const title = await decryptVaultTitle(item.titleCiphertext);

    const payload = await decryptVaultPayload<{

      platform?: string;
      provider?: string;
      host?: string;

      username?: string;
      address?: string;

    }>(item.encryptedPayload);



    return {

      id: item.id,

      title,

      platform: payload.platform ?? payload.provider ?? payload.host ?? '-',

      username: payload.username ?? payload.address ?? '-',

      encryptedPayload: item.encryptedPayload,

    };

  } catch {

    return {

      id: item.id,

      title: '解密失败',

      platform: '-',

      username: '-',

      encryptedPayload: item.encryptedPayload,

    };

  }

}



function openReveal(item: PasswordRow) {

  revealTarget.value = item;

  revealMfaCode.value = '';

  revealedPassword.value = '';

}



async function handleReveal() {

  if (!revealTarget.value) return;

  revealing.value = true;

  error.value = '';

  try {

    await revealVaultPassword(revealTarget.value.id, revealMfaCode.value || undefined);

    const payload = await decryptVaultPayload<{ password?: string }>(

      revealTarget.value.encryptedPayload,

    );

    revealedPassword.value = payload.password ?? '（未设置）';

  } catch (err) {

    error.value = err instanceof Error ? err.message : '查看失败';

  } finally {

    revealing.value = false;

  }

}



function closeReveal() {

  revealTarget.value = null;

  revealedPassword.value = '';

  revealMfaCode.value = '';

}



async function handleDelete(id: string) {

  if (!confirm('确定删除该条目？将移入回收站')) return;

  await deleteVaultItem(id);

  await loadItems();

}

</script>



<template>

  <div class="space-y-6">

    <div class="flex items-center justify-between">

      <p class="text-sm text-slate-500">查看密码需通过二次验证（如已启用 MFA）并记录审计日志</p>

      <VButton variant="primary" @click="router.push('/app/passwords/new')">新增账号密码</VButton>

    </div>



    <div class="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">

      <div v-if="loading" class="p-8 text-center text-slate-400">加载中...</div>

      <div v-else-if="error && !revealTarget" class="p-8 text-center text-red-600">{{ error }}</div>

      <div v-else-if="items.length === 0" class="p-8 text-center text-slate-400">暂无账号密码</div>

      <table v-else class="min-w-full text-sm">

        <thead class="bg-slate-50 text-left text-slate-500">

          <tr>

            <th class="px-6 py-3">标题</th>

            <th class="px-6 py-3">平台</th>

            <th class="px-6 py-3">账号</th>

            <th class="px-6 py-3">操作</th>

          </tr>

        </thead>

        <tbody class="divide-y divide-slate-100">

          <tr v-for="item in items" :key="item.id">

            <td class="px-6 py-4 font-medium">{{ item.title }}</td>

            <td class="px-6 py-4">{{ item.platform }}</td>

            <td class="px-6 py-4">{{ item.username }}</td>

            <td class="px-6 py-4 space-x-3">

              <button class="rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100" @click="openReveal(item)">查看密码</button>

              <button class="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200" @click="router.push(`/app/passwords/${item.id}/edit`)">编辑</button>

              <button class="rounded-xl bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100" @click="handleDelete(item.id)">删除</button>

            </td>

          </tr>

        </tbody>

      </table>

    </div>



    <div

      v-if="revealTarget"

      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"

    >

      <div class="w-full max-w-sm rounded-xl bg-white p-6 ring-1 ring-slate-200">

        <h3 class="font-semibold text-slate-900">查看密码 · {{ revealTarget.title }}</h3>

        <p v-if="mfaEnabled && !revealedPassword" class="mt-2 text-sm text-slate-500">

          请输入二次验证码

        </p>

        <input

          v-if="!revealedPassword"

          v-model="revealMfaCode"

          class="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"

          placeholder="6 位验证码（未启用 MFA 可留空）"

        />

        <p v-if="revealedPassword" class="mt-4 break-all rounded-lg bg-slate-50 p-3 font-mono text-sm">

          {{ revealedPassword }}

        </p>

        <p v-if="error && revealTarget" class="mt-2 text-sm text-red-600">{{ error }}</p>

        <div class="mt-4 flex gap-2">

          <VButton v-if="!revealedPassword" variant="primary" :disabled="revealing" @click="handleReveal">

            {{ revealing ? '验证中...' : '确认查看' }}

          </VButton>

          <VButton variant="secondary" @click="closeReveal">{{ revealedPassword ? '关闭' : '取消' }}</VButton>

        </div>

      </div>

    </div>

  </div>

</template>

