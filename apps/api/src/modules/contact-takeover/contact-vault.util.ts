import { ContactPermissionScope, VaultItemType } from '@prisma/client';

export function canAccessVault(scope: ContactPermissionScope) {
  return scope !== ContactPermissionScope.notify_only;
}

export function getAllowedVaultTypes(scope: ContactPermissionScope): VaultItemType[] | null {
  if (scope === ContactPermissionScope.notify_only) {
    return [];
  }
  if (scope === ContactPermissionScope.view_partial) {
    return [VaultItemType.password, VaultItemType.note];
  }
  return null;
}

const FILE_ACCESS_SCOPES = new Set<ContactPermissionScope>([
  ContactPermissionScope.view_all,
  ContactPermissionScope.export,
  ContactPermissionScope.inactive_only,
  ContactPermissionScope.request_takeover,
]);

export function canAccessFiles(scope: ContactPermissionScope) {
  return FILE_ACCESS_SCOPES.has(scope);
}
