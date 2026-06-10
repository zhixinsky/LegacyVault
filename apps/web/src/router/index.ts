import { createRouter, createWebHistory } from 'vue-router';
import { getToken, vaultSession } from '@/utils/api';
import AppLayout from '@/layouts/AppLayout.vue';
import HomeView from '@/views/HomeView.vue';
import LoginView from '@/views/LoginView.vue';
import ScanLoginView from '@/views/ScanLoginView.vue';
import SetupPasswordView from '@/views/SetupPasswordView.vue';
import UnlockView from '@/views/UnlockView.vue';
import DashboardView from '@/views/DashboardView.vue';
import PasswordsView from '@/views/PasswordsView.vue';
import PasswordCreateView from '@/views/PasswordCreateView.vue';
import FilesView from '@/views/FilesView.vue';
import AlbumsView from '@/views/AlbumsView.vue';
import ContactTakeoverView from '@/views/ContactTakeoverView.vue';
import ContactVaultView from '@/views/ContactVaultView.vue';
import ContactsView from '@/views/ContactsView.vue';
import NoteCreateView from '@/views/NoteCreateView.vue';
import NotesView from '@/views/NotesView.vue';
import SecurityView from '@/views/SecurityView.vue';
import InheritanceView from '@/views/InheritanceView.vue';
import AuditLogsView from '@/views/AuditLogsView.vue';
import ExportView from '@/views/ExportView.vue';
import AccountsHubView from '@/views/AccountsHubView.vue';
import LoginHistoryView from '@/views/LoginHistoryView.vue';
import ProfileView from '@/views/ProfileView.vue';
import RecycleBinView from '@/views/RecycleBinView.vue';
import SearchView from '@/views/SearchView.vue';
import VaultAccountCreateView from '@/views/VaultAccountCreateView.vue';
import VaultAccountsView from '@/views/VaultAccountsView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: LoginView, meta: { guest: true } },
    { path: '/scan-login', name: 'scan-login', component: ScanLoginView, meta: { guest: true } },
    { path: '/setup-password', name: 'setup-password', component: SetupPasswordView, meta: { guest: true } },
    { path: '/unlock', name: 'unlock', component: UnlockView, meta: { requiresAuth: true } },
    { path: '/contact-takeover', name: 'contact-takeover', component: ContactTakeoverView, meta: { guest: true } },
    { path: '/contact-vault', name: 'contact-vault', component: ContactVaultView, meta: { guest: true } },
    {
      path: '/app',
      component: AppLayout,
      meta: { requiresAuth: true, requiresVault: true },
      children: [
        { path: '', redirect: '/app/dashboard' },
        { path: 'dashboard', name: 'dashboard', component: DashboardView },
        { path: 'passwords', name: 'passwords', component: PasswordsView },
        { path: 'passwords/new', name: 'password-create', component: PasswordCreateView },
        { path: 'passwords/:id/edit', name: 'password-edit', component: PasswordCreateView },
        { path: 'accounts', name: 'accounts', component: AccountsHubView },
        { path: 'accounts/:type', name: 'vault-accounts', component: VaultAccountsView },
        { path: 'accounts/:type/new', name: 'vault-account-create', component: VaultAccountCreateView },
        { path: 'accounts/:type/:id/edit', name: 'vault-account-edit', component: VaultAccountCreateView },
        { path: 'notes', name: 'notes', component: NotesView },
        { path: 'notes/new', name: 'note-create', component: NoteCreateView },
        { path: 'notes/:id/edit', name: 'note-edit', component: NoteCreateView },
        { path: 'profile', name: 'profile', component: ProfileView },
        { path: 'security', name: 'security', component: SecurityView },
        { path: 'files', name: 'files', component: FilesView },
        { path: 'albums', name: 'albums', component: AlbumsView },
        { path: 'contacts', name: 'contacts', component: ContactsView },
        { path: 'inheritance', name: 'inheritance', component: InheritanceView },
        { path: 'audit-logs', name: 'audit-logs', component: AuditLogsView },
        { path: 'login-history', name: 'login-history', component: LoginHistoryView },
        { path: 'recycle-bin', name: 'recycle-bin', component: RecycleBinView },
        { path: 'search', name: 'search', component: SearchView },
        { path: 'export', name: 'export', component: ExportView },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const token = getToken();
  const hasVault = Boolean(vaultSession.getVaultKey());

  if (to.meta.requiresVault && !hasVault) {
    return token ? '/unlock' : '/login';
  }

  if (to.meta.requiresAuth && !token) {
    return '/login';
  }

  if (to.meta.guest && token && hasVault && (to.path === '/login' || to.path === '/scan-login' || to.path === '/setup-password')) {
    return '/app/dashboard';
  }

  if (to.path === '/unlock' && hasVault) {
    return '/app/dashboard';
  }

  return true;
});

export default router;
