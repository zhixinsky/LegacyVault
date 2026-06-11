<script setup lang="ts">

import { onMounted, ref } from 'vue';

import { decryptVaultTitle } from '@/utils/crypto-flow';

import {

  getProfile,

  listTrashVaultItems,

  permanentDeleteVaultItem,

  restoreVaultItem,

  type VaultItem,

} from '@/utils/services';



interface TrashRow {

  id: string;

  title: string;

  type: string;

  deletedAt: string;

}



const items = ref<TrashRow[]>([]);

const loading = ref(true);

const mfaEnabled = ref(false);

const mfaCode = ref('');

const error = ref('');



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

    const result = await listTrashVaultItems();

    const rows: TrashRow[] = [];

    for (const item of result.items) {

      rows.push(await parseItem(item));

    }

    items.value = rows;

  } catch (err) {

    error.value = err instanceof Error ? err.message : '加载失败';

  } finally {

    loading.value = false;

  }

}



async function parseItem(item: VaultItem): Promise<TrashRow> {

  try {

    const title = await decryptVaultTitle(item.titleCiphertext);

    return {

      id: item.id,

      title,

      type: item.type,

      deletedAt: item.deletedAt ?? item.updatedAt,

    };

  } catch {

    return { id: item.id, title: '解密失败', type: item.type, deletedAt: item.updatedAt };

  }

}



async function handleRestore(id: string) {

  await restoreVaultItem(id);

  await loadItems();

}



async function handlePurge(id: string) {

  if (!confirm('永久删除后无法恢复，确定继续？')) return;

  if (mfaEnabled.value && !mfaCode.value) {

    error.value = '永久删除需要输入二次验证码';

    return;

  }

  try {

    await permanentDeleteVaultItem(id, mfaCode.value || undefined);

    await loadItems();

  } catch (err) {

    error.value = err instanceof Error ? err.message : '删除失败';

  }

}

</script>



<template>

  <div class="space-y-6">

    <div class="rounded-xl bg-white p-6 ring-1 ring-slate-200">

      <h2 class="font-semibold text-slate-900">回收站</h2>

      <p class="mt-1 text-sm text-slate-500">软删除的保险箱条目保留 30 天（可恢复）；永久删除需二次验证</p>

      <input

        v-if="mfaEnabled"

        v-model="mfaCode"

        class="mt-4 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm"

        placeholder="永久删除时输入验证码"

      />

    </div>



    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>



    <div class="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">

      <div v-if="loading" class="p-8 text-center text-slate-400">加载中...</div>

      <div v-else-if="items.length === 0" class="p-8 text-center text-slate-400">回收站为空</div>

      <table v-else class="min-w-full text-sm">

        <thead class="bg-slate-50 text-left text-slate-500">

          <tr>

            <th class="px-6 py-3">标题</th>

            <th class="px-6 py-3">类型</th>

            <th class="px-6 py-3">删除时间</th>

            <th class="px-6 py-3">操作</th>

          </tr>

        </thead>

        <tbody class="divide-y divide-slate-100">

          <tr v-for="item in items" :key="item.id">

            <td class="px-6 py-4 font-medium">{{ item.title }}</td>

            <td class="px-6 py-4">{{ item.type }}</td>

            <td class="px-6 py-4">{{ new Date(item.deletedAt).toLocaleString() }}</td>

            <td class="px-6 py-4 space-x-3">

              <button class="rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100" @click="handleRestore(item.id)">恢复</button>

              <button class="rounded-xl bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100" @click="handlePurge(item.id)">永久删除</button>

            </td>

          </tr>

        </tbody>

      </table>

    </div>

  </div>

</template>

