const SHELL_CACHE = "blast-shell-v1";
const STATIC_CACHE = "blast-static-v1";

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/academic100l.css",
  "/academic100l.js",
  "/lucide.min.js",
];

// Install: precache the core application shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: purge stale caches and claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== SHELL_CACHE && key !== STATIC_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // 1. Static Assets (Icons, Fonts, Scripts, Styles) -> Cache-First
  if (
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 2. Navigation / Pages & Dynamic APIs -> Network-First with Offline Fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          return caches.match("/offline.html");
        }
        return new Response(JSON.stringify({ success: false, offline: true, message: "Offline mode active" }), {
          headers: { "Content-Type": "application/json" },
        });
      })
  );
});

// 3. Web Push Notifications
self.addEventListener("push", (event) => {
  let data = {
    title: "BlastExams Revision Drill",
    body: "Your daily spaced review queue is ready. Clear your due cards to keep your streak!",
    url: "/#review",
    id: "drill-reminder",
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "https://api.iconify.design/lucide:graduation-cap.svg?color=%2310B981",
    badge: "https://api.iconify.design/lucide:book-open.svg?color=%2310B981",
    data: {
      url: data.url || "/#review",
      id: data.id,
    },
    actions: [
      { action: "review-now", title: "Review Now" },
      { action: "snooze", title: "Later (1h)" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 4. Notification Click & Action Handling
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const action = event.action;
  const notifData = event.notification.data || {};

  if (action === "snooze") {
    // Post to snooze endpoint
    event.waitUntil(
      fetch("/api/notifications/later", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notifData.id }),
      }).catch((err) => console.log("Snooze fetch failed:", err))
    );
    return;
  }

  // Default: Open or focus application window
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const targetUrl = notifData.url || "/#review";
      for (let client of windowClients) {
        if (client.url.includes(self.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
