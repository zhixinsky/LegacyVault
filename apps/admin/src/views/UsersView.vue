<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { VButton } from '@vaultpass/ui';
import { listAdminUsers, updateUserStatus } from '@/utils/services';

const users = ref<Array<{ id: string; phone?: string; email?: string; status: string; lastLoginAt?: string }>>([]);
const loading = ref(true);
const error = ref('');

onMounted(loadUsers);

async function loadUsers() {
  loading.value = true;
  try {
    const result = await listAdminUsers();
    users.value = result.items;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

async function changeStatus(id: string, status: string) {
  try {
    await updateUserStatus(id, status);
    await loadUsers();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '更新失败';
  }
}
</script>

<template>
  <section class="rounded-xl border border-slate-800 bg-slate-900 p-6">
    <h3 class="font-semibold text-white">用户列表</h3>
    <div v-if="loading" class="mt-6 text-slate-400">加载中...</div>
    <div v-else class="mt-4 overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead class="text-slate-400">
          <tr>
            <th class="py-2 pr-4">手机号</th>
            <th class="py-2 pr-4">邮箱</th>
            <th class="py-2 pr-4">状态</th>
            <th class="py-2 pr-4">最后登录</th>
            <th class="py-2">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" class="border-t border-slate-800">
            <td class="py-3 pr-4">{{ user.phone || '—' }}</td>
            <td class="py-3 pr-4">{{ user.email || '—' }}</td>
            <td class="py-3 pr-4">{{ user.status }}</td>
            <td class="py-3 pr-4">{{ user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '—' }}</td>
            <td class="py-3">
              <div class="flex gap-2">
                <VButton v-if="user.status !== 'active'" variant="secondary" @click="changeStatus(user.id, 'active')">
                  启用
                </VButton>
                <VButton v-if="user.status !== 'suspended'" variant="secondary" @click="changeStatus(user.id, 'suspended')">
                  暂停
                </VButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="error" class="mt-3 text-sm text-red-400">{{ error }}</p>
  </section>
</template>
