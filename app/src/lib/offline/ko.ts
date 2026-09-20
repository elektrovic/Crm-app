/**
 * Sendekøen.
 *
 * Alt montøren registrerer legges først i IndexedDB på telefonen, og sendes
 * derfra. Det betyr at en timeføring aldri går tapt fordi dekningen forsvant
 * i en kjeller — og at montøren slipper å vente på et nettverkskall før han
 * kan gå videre.
 *
 * Hver linje har en klientnøkkel. Serveren avviser en nøkkel den har sett
 * før, så et gjensendt kall aldri fører de samme timene to ganger.
 *
 * Kjører i nettleseren.
 */

const DB_NAVN = "montorappen";
const DB_VERSJON = 1;
const BUTIKK = "sendeko";

export type KoType = "timeforing" | "mangel" | "tillegg";

export type KoStatus = "i_ko" | "sender" | "feilet";

export type KoLinje<T = unknown> = {
  klientNokkel: string;
  type: KoType;
  data: T;
  status: KoStatus;
  opprettet: number;
  forsok: number;
  feilmelding?: string;
  /** Kort beskrivelse til køskjermen, f.eks. «3,5 t på 1042». */
  beskrivelse: string;
};

function apneDb(): Promise<IDBDatabase> {
  return new Promise((løs, avvis) => {
    const foresporsel = indexedDB.open(DB_NAVN, DB_VERSJON);
    foresporsel.onupgradeneeded = () => {
      const db = foresporsel.result;
      if (!db.objectStoreNames.contains(BUTIKK)) {
        const butikk = db.createObjectStore(BUTIKK, { keyPath: "klientNokkel" });
        butikk.createIndex("status", "status");
        butikk.createIndex("opprettet", "opprettet");
      }
    };
    foresporsel.onsuccess = () => løs(foresporsel.result);
    foresporsel.onerror = () => avvis(foresporsel.error);
  });
}

async function medButikk<T>(
  modus: IDBTransactionMode,
  arbeid: (butikk: IDBObjectStore) => IDBRequest | void,
): Promise<T> {
  const db = await apneDb();
  return new Promise<T>((løs, avvis) => {
    const tx = db.transaction(BUTIKK, modus);
    const butikk = tx.objectStore(BUTIKK);
    const foresporsel = arbeid(butikk);
    tx.oncomplete = () => {
      db.close();
      løs((foresporsel && "result" in foresporsel ? foresporsel.result : undefined) as T);
    };
    tx.onerror = () => {
      db.close();
      avvis(tx.error);
    };
  });
}

/** Lager en nøkkel som er unik per linje, også uten nett. */
export function lagKlientNokkel(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function leggIKo<T>(
  type: KoType,
  data: T,
  beskrivelse: string,
): Promise<KoLinje<T>> {
  const linje: KoLinje<T> = {
    klientNokkel: lagKlientNokkel(),
    type,
    data,
    status: "i_ko",
    opprettet: Date.now(),
    forsok: 0,
    beskrivelse,
  };
  await medButikk("readwrite", (b) => b.put(linje));
  varsleEndring();
  return linje;
}

export async function hentKo(): Promise<KoLinje[]> {
  const alle = await medButikk<KoLinje[]>("readonly", (b) => b.getAll());
  return (alle ?? []).sort((a, b) => a.opprettet - b.opprettet);
}

export async function antallIKo(): Promise<number> {
  const alle = await hentKo();
  return alle.filter((l) => l.status !== "sender").length;
}

async function oppdater(linje: KoLinje): Promise<void> {
  await medButikk("readwrite", (b) => b.put(linje));
  varsleEndring();
}

export async function fjernFraKo(klientNokkel: string): Promise<void> {
  await medButikk("readwrite", (b) => b.delete(klientNokkel));
  varsleEndring();
}

/** Endepunktet hver kølinje sendes til. */
const ENDEPUNKT: Record<KoType, string> = {
  timeforing: "/api/timer",
  mangel: "/api/mangler",
  tillegg: "/api/tillegg",
};

/**
 * Tømmer køen. Kalles ved oppstart, når nettet kommer tilbake, og når
 * service workeren melder fra om at den fikk en sync-hendelse.
 *
 * Linjer som feiler med en klientfeil (4xx) blir stående som «feilet» og
 * krever at montøren gjør noe — typisk at perioden er låst i Tripletex.
 * Serverfeil (5xx) og nettverksfeil legges tilbake i køen for nytt forsøk.
 */
export async function tomKo(): Promise<{ sendt: number; feilet: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { sendt: 0, feilet: 0 };
  }

  const linjer = (await hentKo()).filter((l) => l.status === "i_ko");
  let sendt = 0;
  let feilet = 0;

  for (const linje of linjer) {
    await oppdater({ ...linje, status: "sender" });

    try {
      const svar = await fetch(ENDEPUNKT[linje.type], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(linje.data as object), klientNokkel: linje.klientNokkel }),
      });

      if (svar.ok) {
        await fjernFraKo(linje.klientNokkel);
        sendt++;
        continue;
      }

      const kropp = (await svar.json().catch(() => ({}))) as { feil?: string };

      if (svar.status >= 400 && svar.status < 500) {
        await oppdater({
          ...linje,
          status: "feilet",
          forsok: linje.forsok + 1,
          feilmelding: kropp.feil ?? `Avvist av serveren (${svar.status}).`,
        });
        feilet++;
      } else {
        await oppdater({
          ...linje,
          status: "i_ko",
          forsok: linje.forsok + 1,
          feilmelding: kropp.feil ?? `Serverfeil (${svar.status}). Prøver igjen.`,
        });
      }
    } catch {
      // Nettet forsvant igjen midt i sendingen — linja blir stående i køen.
      await oppdater({
        ...linje,
        status: "i_ko",
        forsok: linje.forsok + 1,
        feilmelding: "Ingen forbindelse. Sendes når nettet er tilbake.",
      });
    }
  }

  return { sendt, feilet };
}

/** Legger en feilet linje tilbake i køen, fra «Prøv igjen» på køskjermen. */
export async function provIgjen(klientNokkel: string): Promise<void> {
  const alle = await hentKo();
  const linje = alle.find((l) => l.klientNokkel === klientNokkel);
  if (!linje) return;
  await oppdater({ ...linje, status: "i_ko", feilmelding: undefined });
  await tomKo();
}

/* --------------------------------------------------------- hendelser */

const HENDELSE = "montorappen:ko-endret";

function varsleEndring() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(HENDELSE));
  }
}

export function lyttPaKo(tilbakekall: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(HENDELSE, tilbakekall);
  return () => window.removeEventListener(HENDELSE, tilbakekall);
}

/**
 * Kobler køen til nettverksstatus og service workeren.
 * Kalles én gang når appen starter.
 */
export function startKo(): () => void {
  if (typeof window === "undefined") return () => {};

  const vedNettTilbake = () => void tomKo();
  window.addEventListener("online", vedNettTilbake);

  const vedMelding = (e: MessageEvent) => {
    if (e.data?.type === "tom-sendeko") void tomKo();
  };
  navigator.serviceWorker?.addEventListener("message", vedMelding);

  void tomKo();

  return () => {
    window.removeEventListener("online", vedNettTilbake);
    navigator.serviceWorker?.removeEventListener("message", vedMelding);
  };
}
