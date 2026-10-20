// Service worker for web push delivered by Firebase Cloud Messaging.
// The API sends data-only messages (PushService in apps/api); FCM wraps them
// as { data: { title, body, url, tag }, from, fcmMessageId, ... }.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const message = payload.data ?? payload;
  if (!message.title) return;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // A focused tab already shows the realtime toast.
        if (clients.some((client) => client.focused)) return;

        return self.registration.showNotification(message.title, {
          body: message.body,
          icon: "/logo.png",
          badge: "/favicon.ico",
          tag: message.tag || undefined,
          data: { url: message.url || "/app/stores" },
        });
      })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const client = clients.find((c) => c.url.startsWith(self.location.origin));
        if (client) {
          client.focus();
          return client.navigate(url.href);
        }
        return self.clients.openWindow(url.href);
      })
  );
});
