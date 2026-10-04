/**
 * Kjører synk mot Tripletex.
 *
 * To måter å utløse den på:
 *
 * 1. En leder trykker «Synk nå» i admin (vanlig innlogging).
 * 2. En planlagt jobb kaller med `Authorization: Bearer <SYNK_NOKKEL>`.
 *    På Netlify er det `netlify/functions/synk-planlagt.mts`; se README.
 *
 * Synken tar tid når porteføljen er stor, så den kjøres aldri i en
 * forespørsel montøren venter på.
 *
 * TIDSBUDSJETT: Netlify gir funksjoner 26 sekunder, og respekterer ikke
 * `maxDuration` under. Derfor er hvert steg avgrenset — særlig geokodingen,
 * som er det eneste som gjør mange nettverkskall. Det som ikke rekkes,
 * står igjen til neste kjøring. Synken er trygg å kjøre om igjen.
 */
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { synkkjoringer } from "@/db/schema";
import { likeHemmeligheter } from "@/lib/krypto";
import { TripletexFeil } from "@/lib/tripletex/client";
import { synkAlt } from "@/lib/tripletex/synk";

/**
 * Ber om mer tid enn standard. Respekteres av Vercel; Netlify ignorerer den
 * og gir 26 sekunder uansett — derfor er stegene avgrenset i seg selv.
 */
export const maxDuration = 300;

/** Hvor ofte synken får gå når den utløses av besøk. */
const TIME_I_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const adgang = await autoriser(request);
  if (!adgang) {
    return NextResponse.json({ feil: "Ikke autorisert." }, { status: 401 });
  }
  const { tenantId, utloser } = adgang;

  // Raden skrives FØR jobben, ikke etter. Krasjer kjøringen helt — minnet
  // tar slutt, funksjonen blir drept på tidsbudsjettet — står den igjen
  // uten sluttidspunkt. En kjøring uten slutt er et tydeligere spor enn
  // ingen rad i det hele tatt.
  // «Bare hvis den er forfalt»: utløses av at noen åpner portalen, ikke av
  // en planlegger. Sperren ligger her og ikke i nettleseren, fordi ti
  // faner som åpnes samtidig ellers ville startet ti synker.
  const url = new URL(request.url);
  const forfaltsjekk = url.searchParams.get("hvisForfalt") === "1";
  if (forfaltsjekk) {
    const [siste] = await db
      .select({ start: synkkjoringer.start, slutt: synkkjoringer.slutt })
      .from(synkkjoringer)
      .where(eq(synkkjoringer.tenantId, tenantId))
      .orderBy(desc(synkkjoringer.start))
      .limit(1);

    if (siste) {
      const alder = Date.now() - siste.start.getTime();
      // Under en time siden sist: ingenting å gjøre.
      if (alder < TIME_I_MS) {
        return NextResponse.json({ hoppet: "nylig", alderMinutter: Math.round(alder / 60000) });
      }
      // Startet, men aldri avsluttet, og fortsatt fersk: en annen kjøring
      // er trolig i gang. To samtidige synker mot Tripletex er sløsing i
      // beste fall.
      if (!siste.slutt && alder < 10 * 60 * 1000) {
        return NextResponse.json({ hoppet: "pågår" });
      }
    }
  }

  const [kjoring] = await db
    .insert(synkkjoringer)
    .values({ tenantId, utloser: forfaltsjekk && utloser === "manuell" ? "besok" : utloser })
    .returning({ id: synkkjoringer.id });

  async function avslutt(ok: boolean, felter: { resultat?: unknown; feil?: string }) {
    if (!kjoring) return;
    await db
      .update(synkkjoringer)
      .set({ slutt: new Date(), ok, resultat: felter.resultat ?? null, feil: felter.feil ?? null })
      .where(eq(synkkjoringer.id, kjoring.id));
  }

  try {
    const resultat = await synkAlt(tenantId);
    await avslutt(true, { resultat });
    return NextResponse.json(resultat);
  } catch (feil) {
    console.error("Synk mot Tripletex feilet", feil);

    // Meldinga sendes med tilbake. Endepunktet krever allerede leder eller
    // synknøkkel, så det er ingen fremmed som leser den — og «se
    // serverloggen» er ubrukelig for den som ikke når serverloggen.
    // Tripletex' eget svar er ofte det eneste som sier hva som er galt.
    const melding = feil instanceof Error ? feil.message : "Ukjent feil.";
    const detaljer =
      feil instanceof TripletexFeil && typeof feil.detaljer === "string"
        ? feil.detaljer.slice(0, 500)
        : undefined;

    await avslutt(false, { feil: [melding, detaljer].filter(Boolean).join(" — ") });
    return NextResponse.json({ feil: melding, fraTripletex: detaljer }, { status: 502 });
  }
}

/**
 * Returnerer hvem synken kjører for og hva som utløste den, eller null.
 *
 * Nøkkelen sammenlignes med en konstanttidsfunksjon — en vanlig `===` bruker
 * målbart kortere tid jo tidligere forskjellen ligger.
 */
/**
 * Hvem satte i gang synken.
 *
 * «besok» er ikke det samme som «manuell»: ingen trykket, men et menneske
 * var innom. Skillet er verdt en egen verdi, fordi det er loggen man leser
 * når man lurer på hvorfor tallene er gamle.
 */
type Adgang = { tenantId: string; utloser: "plan" | "manuell" | "besok" };

async function autoriser(request: Request): Promise<Adgang | null> {
  const header = request.headers.get("authorization");
  const nokkel = process.env.SYNK_NOKKEL;

  if (header?.startsWith("Bearer ") && nokkel) {
    const oppgitt = header.slice("Bearer ".length);
    if (likeHemmeligheter(oppgitt, nokkel)) {
      return { tenantId: process.env.DEFAULT_TENANT_ID ?? "halland", utloser: "plan" };
    }
    return null;
  }

  const okt = await auth();
  if (!okt?.user?.id) return null;
  if (okt.user.rolle === "montor") return null;
  return { tenantId: okt.user.tenantId, utloser: "manuell" };
}
