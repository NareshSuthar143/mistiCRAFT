/* mistiCRAFT — service worker for admin new-order push notifications.
   Registered only from admin.html (see registerPushNotifications there).
   Scope is the site root so notificationclick can find/open any open
   admin.html tab regardless of which page registered it. */

self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_e) { /* non-JSON payload, ignore */ }
  var title = data.title || 'mistiCRAFT';
  var options = {
    body: data.body || 'New activity on your store.',
    tag: data.orderId ? ('order-' + data.orderId) : undefined,
    data: { orderId: data.orderId || null }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf('admin.html') > -1 && 'focus' in list[i]) return list[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/admin.html');
    })
  );
});
