/* eslint-disable no-undef */
// Firebase Cloud Messaging background service worker.
// This worker is intentionally separate from the app-shell service worker and
// must never be unregistered by src/pwa/registerSW.ts (see PROTECTED_SW_SCRIPTS).

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// ============================================================================
// TODO: REPLACE WITH REAL FIREBASE WEB CONFIG (public/client-safe values).
// Firebase console -> Project settings -> General -> Your apps -> Web app.
// These MUST match the config used in src/lib/pushNotifications.ts.
// ============================================================================
const firebaseConfig = {
  apiKey: 'REPLACE_WITH_FIREBASE_API_KEY',
  authDomain: 'REPLACE_WITH_FIREBASE_AUTH_DOMAIN',
  projectId: 'REPLACE_WITH_FIREBASE_PROJECT_ID',
  storageBucket: 'REPLACE_WITH_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'REPLACE_WITH_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'REPLACE_WITH_FIREBASE_APP_ID',
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title =
    payload?.notification?.title || payload?.data?.title || 'AQTA LMS';
  const body = payload?.notification?.body || payload?.data?.body || '';

  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload?.data?.tag || undefined,
    data: {
      url: payload?.data?.url || '/',
      ...(payload?.data || {}),
    },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
