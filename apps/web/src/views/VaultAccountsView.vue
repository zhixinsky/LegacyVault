<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import {
  getVaultItemTypeConfig,
  isManagedVaultType,
  type VaultItemFieldDef,
} from '@vaultpass/types';
import { decryptVaultPayload, decryptVaultTitle } from '@/utils/crypto-flow';
import {
  deleteVaultItem,
  getProfile,
  listVaultItems,
  revealVaultPassword,
  type VaultItem,
} from '@/utils/services';

interface AccountRow {
  id: string;
  title: string;
  columns: Record<string, string>;
  encryptedPayload: string;
}

const route = useRoute();
const router = useRouter();
const vaultType = computed(() => String(route.params.type ?? ''));
const config = computed(() => getVaultItemTypeConfig(vaultType.value));
const listFields = computed(() => config.value?.fields.filter((f) => f.listColumn) ?? []);
const sensitiveFields = computed(() => config.value?.fields.filter((f) => f.sensitive) ?? []);

const items = ref<AccountRow[]>([]);
const loading = ref(true);
const mfaEnabled = ref(false);
const error = ref('');
const revealTarget = ref<AccountRow | null>(null);
const revealMfaCode = ref('');
const revealedValues = ref<Record<string, string>>({});
const revealing = ref(false);

watch(vaultType, () => {
  if (!isManagedVaultType(vaultType.value)) {
    router.replace('/app/accounts');
    return;
  }
  loadItems();
});

onMounted(async () => {
  if (!isManagedVaultType(vaultType.value)) {
    router.replace('/app/accounts');
    return;
  }
  try {
    const profile = await getProfile();
    mfaEnabled.value = profile.mfaEnabled;
  } catch {
    // ignore
  }
  await loadItems();
});

async function loadItems() {
  if (!config.value) return;
  loading.value = true;
  error.value = '';
  try {
    const result = await listVaultItems(vaultType.value);
    const rows: AccountRow[] = [];
    for (const item of result.items) {
      rows.push(await parseItem(item, listFields.value));
    }
    items.value = rows;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

async function parseItem(item: VaultItem, fields: VaultItemFieldDef[]): Promise<AccountRow> {
  try {
    const title = await decryptVaultTitle(item.titleCiphertext);
    const payload = await decryptVaultPayload<Record<string, string>>(item.encryptedPayload);
    const columns: Record<string, string> = {};
    for (const field of fields) {
      columns[field.key] = payload[field.key] ?? '-';
    }
    return { id: item.id, title, columns, encryptedPayload: item.encryptedPayload };
  } catch {
    return {
      id: item.id,
      title: '解密失败',
      columns: Object.fromEntries(fields.map((f) => [f.key, '-'])),
      encryptedPayload: item.encryptedPayload,
    };
  }
}

function openReveal(item: AccountRow) {
  revealTarget.value = item;
  revealMfaCode.value = '';
  revealedValues.value = {};
}

async function handleReveal() {
  if (!revealTarget.value || !config.value) return;
  revealing.value = true;
  error.value = '';
  try {
    await revealVaultPassword(revealTarget.value.id, revealMfaCode.value || undefined);
    const payload = await decryptVaultPayload<Record<string, string>>(
      revealTarget.value.encryptedPayload,
    );
    const values: Record<string, string> = {};
    for (const field of sensitiveFields.value) {
      values[field.key] = payload[field.key] ?? '（未设置）';
    }
    revealedValues.value = values;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '查看失败';
  } finally {
    revealing.value = false;
  }
}

function closeReveal() {
  revealTarget.value = null;
  revealedValues.value = {};
  revealMfaCode.value = '';
}

async function handleDelete(id: string) {
  if (!confirm('确定删除该条目？将移入回收站')) return;
  await deleteVaultItem(id);
  await loadItems();
}
</script>

<template>
  <div v-if="config" class="space-y-6">
    <div class="flex items-center justify-between">
      <p class="text-sm text-slate-500">
        {{ config.emoji }} {{ config.label }} · 查看敏感信息需二次验证并记录审计日志
      </p>
      <VButton variant="primary" @click="router.push(`/app/accounts/${vaultType}/new`)">
        新增{{ config.shortLabel }}账户
      </VButton>
    </div>

    <div class="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
      <div v-if="loading" class="p-8 text-center text-slate-400">加载中...</div>
      <div v-else-if="error && !revealTarget" class="p-8 text-center text-red-600">{{ error }}</div>
      <div v-else-if="items.length === 0" class="p-8 text-center text-slate-400">暂无{{ config.label }}</div>
      <table v-else class="min-w-full text-sm">
        <thead class="bg-slate-50 text-left text-slate-500">
          <tr>
            <th class="px-6 py-3">标题</th>
            <th v-for="field in listFields" :key="field.key" class="px-6 py-3">{{ field.label }}</th>
            <th class="px-6 py-3">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in items" :key="item.id">
            <td class="px-6 py-4 font-medium">{{ item.title }}</td>
            <td v-for="field in listFields" :key="field.key" class="px-6 py-4">
              {{ item.columns[field.key] }}
            </td>
            <td class="space-x-3 px-6 py-4">
              <button class="text-blue-600 hover:underline" @click="openReveal(item)">查看敏感信息</button>
              <button class="text-slate-600 hover:underline" @click="router.push(`/app/accounts/${vaultType}/${item.id}/edit`)">编辑</button>
              <button class="text-red-600 hover:underline" @click="handleDelete(item.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="revealTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h3 class="font-semibold text-slate-900">敏感信息 · {{ revealTarget.title }}</h3>
        <p v-if="mfaEnabled && !Object.keys(revealedValues).length" class="mt-2 text-sm text-slate-500">
          请输入二次验证码
        </p>
        <input
          v-if="!Object.keys(revealedValues).length"
          v-model="revealMfaCode"
          class="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="6 位验证码（未启用 MFA 可留空）"
        />
        <dl v-if="Object.keys(revealedValues).length" class="mt-4 space-y-3">
          <div v-for="field in sensitiveFields" :key="field.key">
            <dt class="text-xs text-slate-500">{{ field.label }}</dt>
            <dd class="mt-1 break-all rounded-lg bg-slate-50 p-2 font-mono text-sm">
              {{ revealedValues[field.key] ?? '（未设置）' }}
            </dd>
          </div>
        </dl>
        <p v-if="error && revealTarget" class="mt-2 text-sm text-red-600">{{ error }}</p>
        <div class="mt-4 flex gap-2">
          <VButton
            v-if="!Object.keys(revealedValues).length"
            variant="primary"
            :disabled="revealing"
            @click="handleReveal"
          >
            {{ revealing ? '验证中...' : '确认查看' }}
          </VButton>
          <VButton variant="secondary" @click="closeReveal">
            {{ Object.keys(revealedValues).length ? '关闭' : '取消' }}
          </VButton>
        </div>
      </div>
    </div>
  </div>
</template>
