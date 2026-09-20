/**
 * Service worker for Montørappen.
 *
 * Målet er ikke å gjøre hele appen offline, men å sikre at montøren aldri
 * møter en blank feilside i en kjeller uten dekning: skallet ligger i cache,
 * og det som skal sendes ligger trygt i IndexedDB til nettet er tilbake.
 */

const CACHE = "montorappen-v1";

/** Sider som må virke uten nett. */
const SKALL = ["/hjem", "/timer", "/ko", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SKALL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((navn) =>
        Promise.all(navn.filter((n) => n !== CACHE).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skriving skal aldri serveres fra cache — den går i sendekøen i stedet.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Innlogging og API-kall skal alltid treffe nettverket.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Nettverk først, med cache som fallback. Da ser montøren ferske data
    // når han har dekning, og forrige versjon når han ikke har det.
    event.respondWith(
      fetch(request)
        .then((svar) => {
          const kopi = svar.clone();
          caches.open(CACHE).then((c) => c.put(request, kopi));
          return svar;
        })
        .catch(async () => {
          const truffet = await caches.match(request);
          return truffet ?? caches.match("/offline");
        }),
    );
    return;
  }

  // Statiske filer: cache først, oppdater i bakgrunnen.
  event.respondWith(
    caches.match(request).then((truffet) => {
      const fraNett = fetch(request)
        .then((svar) => {
          const kopi = svar.clone();
          caches.open(CACHE).then((c) => c.put(request, kopi));
          return svar;
        })
        .catch(() => truffet);
      return truffet ?? fraNett;
    }),
  );
});

/**
 * Background Sync: når nettet er tilbake, ber vi appen tømme køen.
 * Selve sendingen skjer i appen, ikke her, slik at den bruker samme
 * innloggede økt og samme validering som en vanlig føring.
 */
self.addEventListener("sync", (event) => {
  if (event.tag === "tom-sendeko") {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then((klienter) => {
        for (const k of klienter) k.postMessage({ type: "tom-sendeko" });
      }),
    );
  }
});
