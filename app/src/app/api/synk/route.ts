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
import { auth } from "@/auth";
import { likeHemmeligheter } from "@/lib/krypto";
import { synkAlt } from "@/lib/tripletex/synk";

/**
 * Ber om mer tid enn standard. Respekteres av Vercel; Netlify ignorerer den
 * og gir 26 sekunder uansett — derfor er stegene avgrenset i seg selv.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  const tenantId = await autoriser(request);
  if (!tenantId) {
    return NextResponse.json({ feil: "Ikke autorisert." }, { status: 401 });
  }

  try {
    const resultat = await synkAlt(tenantId);
    return NextResponse.json(resultat);
  } catch (feil) {
    console.error("Synk mot Tripletex feilet", feil);
    return NextResponse.json(
      { feil: "Synken feilet. Se serverloggen for detaljer." },
      { status: 502 },
    );
  }
}

/**
 * Returnerer kunde-ID-en synken skal kjøre for, eller null.
 *
 * Nøkkelen sammenlignes med en konstanttidsfunksjon — en vanlig `===` bruker
 * målbart kortere tid jo tidligere forskjellen ligger.
 */
async function autoriser(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  const nokkel = process.env.SYNK_NOKKEL;

  if (header?.startsWith("Bearer ") && nokkel) {
    const oppgitt = header.slice("Bearer ".length);
    if (likeHemmeligheter(oppgitt, nokkel)) {
      return process.env.DEFAULT_TENANT_ID ?? "halland";
    }
    return null;
  }

  const okt = await auth();
  if (!okt?.user?.id) return null;
  if (okt.user.rolle === "montor") return null;
  return okt.user.tenantId;
}
