import { createRouter, createWebHistory } from 'vue-router';
import AdminLayout from '@/layouts/AdminLayout.vue';
import AuditLogsView from '@/views/AuditLogsView.vue';
import DashboardView from '@/views/DashboardView.vue';
import InheritanceEventsView from '@/views/InheritanceEventsView.vue';
import LoginView from '@/views/LoginView.vue';
import NotificationLogsView from '@/views/NotificationLogsView.vue';
import IpBlacklistView from '@/views/IpBlacklistView.vue';
import SecurityAlertsView from '@/views/SecurityAlertsView.vue';
import UsersView from '@/views/UsersView.vue';
import { getAdminKey } from '@/utils/api';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { guest: true } },
    {
      path: '/',
      component: AdminLayout,
      meta: { requiresAdmin: true },
      children: [
        { path: '', name: 'dashboard', component: DashboardView },
        { path: 'users', name: 'users', component: UsersView },
        { path: 'inheritance-events', name: 'inheritance-events', component: InheritanceEventsView },
        { path: 'security-alerts', name: 'security-alerts', component: SecurityAlertsView },
        { path: 'ip-blacklist', name: 'ip-blacklist', component: IpBlacklistView },
        { path: 'audit-logs', name: 'audit-logs', component: AuditLogsView },
        { path: 'notification-logs', name: 'notification-logs', component: NotificationLogsView },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const apiKey = getAdminKey();

  if (to.meta.requiresAdmin && !apiKey) {
    return '/login';
  }

  if (to.meta.guest && apiKey) {
    return '/';
  }

  return true;
});

export default router;
