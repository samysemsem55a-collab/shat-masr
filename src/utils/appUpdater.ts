import { registerSW } from 'virtual:pwa-register';
import { toast } from './appToast';

const VERSION_CHECK_INTERVAL_MS = 4 * 60 * 1000;
const SW_UPDATE_INTERVAL_MS = 3 * 60 * 1000;
const VISIBILITY_THROTTLE_MS = 45 * 1000;
const SESSION_RELOAD_KEY = 'shat_masr_reloaded_ver';

let isInitialized = false;
let bootServerVersion: string | null = null;
let swUpdateFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
let lastCheckAt = 0;

export async function applySmoothAppUpdate(targetVersion?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if (targetVersion) {
      sessionStorage.setItem(SESSION_RELOAD_KEY, targetVersion);
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name).catch(() => false)));
    }
    if (swUpdateFn) {
      await Promise.race([
        swUpdateFn(true),
        new Promise<void>((resolve) => setTimeout(resolve, 1200)),
      ]).catch(() => {});
    }
  } catch {}
  window.location.reload();
}

async function checkServerVersion(isInitial: boolean): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  try {
    const res = await fetch(`/api/app-version?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return;
    const data = await res.json();
    const version = typeof data?.version === 'string' ? data.version.trim() : '';
    if (!version) return;

    if (!bootServerVersion) {
      bootServerVersion = version;
      return;
    }

    if (isInitial || version === bootServerVersion) return;

    const alreadyReloadedFor = sessionStorage.getItem(SESSION_RELOAD_KEY);
    if (alreadyReloadedFor === version) return;

    sessionStorage.setItem(SESSION_RELOAD_KEY, version);
    toast.info('تم إصدار تحديث جديد — جاري التحديث تلقائياً ✨', { duration: 1800 });
    setTimeout(() => {
      applySmoothAppUpdate(version);
    }, 900);
  } catch {}
}

export function initSmoothAppUpdates(): void {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  let swRegistration: ServiceWorkerRegistration | undefined;

  if ('serviceWorker' in navigator) {
    if (import.meta.env.PROD) {
      const hadController = Boolean(navigator.serviceWorker.controller);

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) return;
        const guardKey = 'shat_masr_sw_ctrl_reloaded';
        if (sessionStorage.getItem(guardKey)) return;
        sessionStorage.setItem(guardKey, '1');
        window.location.reload();
      });

      swUpdateFn = registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
          swRegistration = registration;
          if (registration) {
            setInterval(() => {
              registration.update().catch(() => {});
            }, SW_UPDATE_INTERVAL_MS);
          }
        },
        onNeedRefresh() {
          toast.info('جاري تفعيل التحديث الجديد للتطبيق ✨', { duration: 1800 });
          setTimeout(() => {
            swUpdateFn?.(true).catch(() => {
              window.location.reload();
            });
          }, 700);
        },
        onOfflineReady() {},
      });
    } else {
      navigator.serviceWorker
        .getRegistrations?.()
        .then((regs) => {
          regs.forEach((reg) => {
            const scriptUrl =
              reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
            if (scriptUrl.includes('dev-sw.js')) {
              reg.unregister().catch(() => {});
            }
          });
        })
        .catch(() => {});
    }
  }

  // Initial server version baseline + periodic smooth update check
  checkServerVersion(true);
  setInterval(() => {
    checkServerVersion(false);
  }, VERSION_CHECK_INTERVAL_MS);

  const triggerThrottledRefreshCheck = () => {
    const now = Date.now();
    if (now - lastCheckAt < VISIBILITY_THROTTLE_MS) return;
    lastCheckAt = now;
    if (swRegistration) {
      swRegistration.update().catch(() => {});
    }
    checkServerVersion(false);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      triggerThrottledRefreshCheck();
    }
  });
  window.addEventListener('online', triggerThrottledRefreshCheck);
}
