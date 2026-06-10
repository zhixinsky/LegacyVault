import type { PaginatedResponse } from '@vaultpass/types';
import { request } from './api';

export interface AdminStats {
  users: number;
  activeEvents: number;
  highRiskToday: number;
}

export interface AdminUserItem {
  id: string;
  phone?: string;
  email?: string;
  status: string;
  lastLoginAt?: string;
  mfaEnabled: boolean;
  createdAt: string;
}

export interface AdminAuditLogItem {
  id: string;
  action: string;
  actorType: string;
  riskLevel: string;
  ip?: string;
  device?: string;
  createdAt: string;
  userId?: string;
  user?: {
    id: string;
    phone?: string;
    email?: string;
    status: string;
  };
}

export interface AdminInheritanceEventItem {
  id: string;
  status: string;
  currentStage: string;
  triggerAt: string;
  createdAt: string;
  user: {
    id: string;
    phone?: string;
    email?: string;
    status: string;
  };
}

export function getAdminStats() {
  return request<AdminStats>({ url: '/admin/stats' });
}

export function listAdminUsers(page = 1) {
  return request<PaginatedResponse<AdminUserItem> & { page: number; pageSize: number }>({
    url: '/admin/users',
    query: { page, pageSize: 20 },
  });
}

export function updateUserStatus(id: string, status: string) {
  return request({
    url: `/admin/users/${id}/status`,
    method: 'PATCH',
    body: { status },
  });
}

export function listAdminAuditLogs(page = 1, riskLevel?: string) {
  return request<PaginatedResponse<AdminAuditLogItem> & { page: number; pageSize: number }>({
    url: '/admin/audit-logs',
    query: { page, pageSize: 20, ...(riskLevel ? { riskLevel } : {}) },
  });
}

export function listAdminSecurityAlerts(page = 1) {
  return request<PaginatedResponse<AdminAuditLogItem> & { page: number; pageSize: number }>({
    url: '/admin/security-alerts',
    query: { page, pageSize: 30 },
  });
}

export function listAdminInheritanceEvents(page = 1) {
  return request<PaginatedResponse<AdminInheritanceEventItem> & { page: number; pageSize: number }>({
    url: '/admin/inheritance-events',
    query: { page, pageSize: 20 },
  });
}

export function runInheritanceScan() {
  return request<{ scanned: number; processed: number }>({
    url: '/admin/inheritance/scan',
    method: 'POST',
  });
}

export interface AdminNotificationLogItem {
  id: string;
  channel: string;
  notificationType: string;
  status: string;
  target?: string;
  createdAt: string;
  user: { phone?: string; email?: string };
}

export function listAdminNotificationLogs(page = 1) {
  return request<PaginatedResponse<AdminNotificationLogItem> & { page: number; pageSize: number }>({
    url: '/admin/notification-logs',
    query: { page, pageSize: 50 },
  });
}

export interface AdminIpBlacklistItem {
  ip: string;
  reason?: string | null;
  source: 'env' | 'database';
  createdAt: string | null;
}

export function listAdminIpBlacklist() {
  return request<{ items: AdminIpBlacklistItem[] }>({ url: '/admin/ip-blacklist' });
}

export function addAdminIpBlacklist(ip: string, reason?: string) {
  return request({
    url: '/admin/ip-blacklist',
    method: 'POST',
    body: { ip, reason },
  });
}

export function removeAdminIpBlacklist(ip: string) {
  return request({
    url: `/admin/ip-blacklist/${encodeURIComponent(ip)}`,
    method: 'DELETE',
  });
}
