import { getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { firebaseConfig } from './firebase';

let fcmInitialized = false;

export type NotificationDeepLink = {
  senderId?: string;
  roomId?: string;
  openForum?: boolean;
};

/**
 * Registers /firebase-messaging-sw.js, initializes Firebase Messaging if supported,
 * and falls back cleanly to standard Web Notification API when FCM is unavailable.
 */
export async function initExternalPushNotifications(
  onForegroundPayload?: (payload: { title: string; body: string; data?: NotificationDeepLink }) => void,
  onDeepLinkClick?: (data: NotificationDeepLink) => void
): Promise<{ supported: boolean; permission: NotificationPermission | 'unsupported'; token?: string | null }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, permission: 'unsupported', token: null };
  }

  // Listen to Service Worker click messages
  if ('serviceWorker' in navigator && !fcmInitialized) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.data && onDeepLinkClick) {
        onDeepLinkClick(event.data.data);
      }
    });
  }

  let swRegistration: ServiceWorkerRegistration | undefined;
  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      const activeSw = swRegistration.active || swRegistration.installing || swRegistration.waiting;
      if (activeSw) {
        activeSw.postMessage({ type: 'INIT_FCM_CONFIG', config: firebaseConfig });
      }
    } catch (err) {
      console.warn('[Push] SW registration notice:', err);
    }
  }

  try {
    const fcmSupported = await isSupported();
    if (fcmSupported && getApps().length > 0) {
      const messaging = getMessaging(getApps()[0]);

      if (!fcmInitialized) {
        fcmInitialized = true;
        onMessage(messaging, (payload) => {
          const title = payload.notification?.title || 'شات مصر';
          const body = payload.notification?.body || 'لديك إشعار جديد';
          if (onForegroundPayload) {
            onForegroundPayload({ title, body, data: (payload.data as any) || {} });
          }
        });
      }

      if (Notification.permission === 'granted') {
        try {
          const token = await getToken(messaging, {
            serviceWorkerRegistration: swRegistration
          }).catch(() => null);
          if (token) {
            localStorage.setItem('shat_masr_fcm_token', token);
          }
          return { supported: true, permission: Notification.permission, token };
        } catch {
          return { supported: true, permission: Notification.permission, token: null };
        }
      }

      return { supported: true, permission: Notification.permission, token: null };
    }
  } catch (err) {
    console.warn('[Push] FCM check notice:', err);
  }

  return { supported: true, permission: Notification.permission, token: null };
}

export async function requestPushNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      await initExternalPushNotifications();
    }
    return result;
  } catch {
    return Notification.permission;
  }
}

export function triggerExternalBrowserNotification(
  title: string,
  body: string,
  data?: NotificationDeepLink,
  onClick?: (data?: NotificationDeepLink) => void
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // Show external OS notification when tab is backgrounded OR for important incoming alerts
  const showViaNotification = () => {
    try {
      const n = new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        dir: 'rtl',
        lang: 'ar',
        tag: data?.senderId ? `dm_${data.senderId}` : data?.roomId ? `room_${data.roomId}` : 'shat_masr_alert'
      });
      n.onclick = () => {
        try {
          window.focus();
          if (onClick) onClick(data);
        } catch {}
        n.close();
      };
    } catch {}
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => {
        if (reg && typeof reg.showNotification === 'function') {
          reg.showNotification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            dir: 'rtl',
            lang: 'ar',
            data: data || {}
          }).catch(() => showViaNotification());
        } else {
          showViaNotification();
        }
      })
      .catch(() => showViaNotification());
  } else {
    showViaNotification();
  }
}
