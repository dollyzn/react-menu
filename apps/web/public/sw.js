// Service worker for web push. Payload shape: PushMessage in
// apps/api/app/services/push_service.ts ({ title, body, url?, tag? }).

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let message;
  try {
    message = event.data.json();
  } catch {
    message = { title: "React Menu", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: "/logo.png",
      badge: "/favicon.ico",
      tag: message.tag,
      data: { url: message.url || "/app/stores" },
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
