// Service worker SOMENTE para push notifications.
// Propositalmente NÃO intercepta fetch / não faz cache offline — assim não há
// risco de servir conteúdo velho nem de quebrar o carregamento do app.

self.addEventListener("install", (event) => {
  // Ativa o novo SW imediatamente, sem esperar abas antigas fecharem.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Marido pra Quê?", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Marido pra Quê?";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || data.link || title,
    data: { link: data.link || "/" },
    renotify: !!data.tag,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Se já houver uma aba aberta, foca nela e navega.
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(link);
          return;
        }
      }
      // Senão, abre uma nova.
      if (self.clients.openWindow) return self.clients.openWindow(link);
    }),
  );
});
