/* BiZouk — Service Worker
   Stratégie volontairement simple : le réseau est TOUJOURS prioritaire.
   Le cache ne sert que de secours hors-ligne, jamais à retenir une ancienne
   version d'une page. Résultat : aucune "réinstallation" nécessaire quand
   Steve met à jour le site ou ajoute des thèmes/chapitres via Supabase —
   ça reste des appels réseau normaux, non concernés par ce cache. */

const CACHE = "bizouk-shell-v1";

const COQUILLE = [
  "/", "/index.html", "/manifest.json",
  "/css/style.css"
];

self.addEventListener("install", (evt) => {
  self.skipWaiting();
  evt.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(COQUILLE)).catch(() => {})
  );
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

/* Prêt à recevoir de vraies notifications push, une fois qu'un envoi côté serveur
   (Edge Function + tâche planifiée) sera mis en place. */
self.addEventListener("push", (evt) => {
  let donnees = {};
  try { donnees = evt.data ? evt.data.json() : {}; } catch (e) {}
  const titre = donnees.titre || "BiZouk";
  const options = {
    body: donnees.corps || "Un nouveau défi t'attend !",
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    data: { url: donnees.url || "/index.html" }
  };
  evt.waitUntil(self.registration.showNotification(titre, options));
});

self.addEventListener("notificationclick", (evt) => {
  evt.notification.close();
  const url = (evt.notification.data && evt.notification.data.url) || "/index.html";
  evt.waitUntil(clients.openWindow(url));
});

self.addEventListener("fetch", (evt) => {
  const req = evt.request;

  // On ne gère que les requêtes GET du même site.
  // Tout le reste (Supabase, API, CDN externes) passe directement par le réseau,
  // sans jamais être mis en cache : le contenu (thèmes, chapitres, mots) reste
  // toujours à jour, en direct.
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  evt.respondWith(
    fetch(req)
      .then((reponse) => {
        const copie = reponse.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copie)).catch(() => {});
        return reponse;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/index.html")))
  );
});
