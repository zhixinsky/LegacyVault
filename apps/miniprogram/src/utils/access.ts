import { getToken, vaultSession } from './api';
import { getProfile } from './services';

function openLoginPage() {
  uni.navigateTo({ url: '/pages/login/login' });
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export function isVaultUnlocked() {
  return Boolean(vaultSession.getVaultKey());
}

export function promptLogin(message = '登录后即可继续访问加密内容。') {
  uni.showModal({
    title: '需要登录',
    content: message,
    confirmText: '去登录',
    cancelText: '继续预览',
    success: (res) => {
      if (res.confirm) {
        openLoginPage();
      }
    },
  });
}

export function ensureLoggedIn(message?: string) {
  if (isLoggedIn()) {
    return true;
  }
  promptLogin(message);
  return false;
}

export async function ensureVaultAccess(message = '登录并解锁保险箱后即可查看或编辑加密内容。') {
  if (!ensureLoggedIn(message)) {
    return false;
  }

  if (isVaultUnlocked()) {
    return true;
  }

  try {
    const profile = await getProfile();
    uni.navigateTo({
      url: profile.hasVault ? '/pages/unlock-vault/unlock-vault' : '/pages/create-vault-password/create-vault-password',
    });
  } catch {
    promptLogin(message);
  }
  return false;
}
