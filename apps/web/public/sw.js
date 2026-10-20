// Service worker: offline fallback for the installed app and web push
// delivered by Firebase Cloud Messaging.
//
// Pages and API data are never cached (menus, stock and orders must be
// live); only the offline page and its icon are. Navigations go to the
// network (with navigation preload) and fall back to /offline.html.

const CACHE = "react-menu-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        return preloaded || (await fetch(event.request));
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }
    })()
  );
});

// Push: the API sends data-only messages (PushService in apps/api); FCM wraps
// them as { data: { title, body, url, tag }, from, fcmMessageId, ... }.

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
          icon: "/icons/icon-192.png",
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
