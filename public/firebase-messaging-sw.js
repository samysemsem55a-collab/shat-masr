/* Firebase Cloud Messaging Service Worker for شات مصر */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');


self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'INIT_FCM_CONFIG' && event.data.config) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(event.data.config);
        const messaging = firebase.messaging();
        messaging.onBackgroundMessage((payload) => {
          const title = payload?.notification?.title || 'شات مصر';
          const options = {
            body: payload?.notification?.body || 'لديك رسالة أو إشعار جديد',
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            data: payload?.data || {},
            dir: 'rtl',
            lang: 'ar'
          };
          self.registration.showNotification(title, options);
        });
      }
    } catch {}
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const title = payload?.notification?.title || payload?.title || 'شات مصر';
    const body = payload?.notification?.body || payload?.body || 'لديك رسالة جديدة في شات مصر';
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: payload?.data || {},
        dir: 'rtl',
        lang: 'ar'
      })
    );
  } catch {}
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification?.data || {};
  const targetUrl = data.senderId
    ? `/?chatWith=${encodeURIComponent(data.senderId)}`
    : data.roomId
    ? `/?room=${encodeURIComponent(data.roomId)}`
    : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_CLICK', data });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
