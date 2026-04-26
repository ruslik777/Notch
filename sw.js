const CACHE = 'notch-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'SCHEDULE_NOTIFS_V2') {
    const { items } = event.data;
    if (!Array.isArray(items)) return;
    items.forEach(({ delay, title, body, tag }) => {
      if (!delay || delay <= 0) return;
      setTimeout(() => {
        self.registration.showNotification(title || 'Notch', {
          body: body || 'Не забудь записать трату сегодня!',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: tag || 'notch-reminder',
          renotify: true,
          vibrate: [200, 100, 200],
          data: { url: '/app.html' },
        });
      }, delay);
    });
  }

  if (event.data.type === 'SCHEDULE_STREAK_REMINDER') {
    const { delay, title, body } = event.data;
    if (delay <= 0) return;
    setTimeout(() => {
      self.registration.showNotification(title || 'Notch', {
        body: body || 'Не забудь записать трату сегодня!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'streak-reminder',
        renotify: false,
        vibrate: [200, 100, 200],
        data: { url: '/app.html' },
      });
    }, delay);
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('/app.html') && 'focus' in client) return client.focus();
      }
      return clients.openWindow(event.notification.data?.url || '/app.html');
    })
  );
});
