/**
 * Helsesjekk.
 *
 * Svarer på ett spørsmål: når appen databasen, og hvis ikke — hvorfor?
 *
 * Grunnen til at den finnes: når noe er galt med tilkoblingen, ser
 * brukeren bare «A server error occurred». Den virkelige feilmeldingen
 * ligger i serverloggen, og den er ikke alltid lett å komme til. Da blir
 * feilsøking gjetting. Dette gjør den til lesing.
 *
 * Feilmeldinger fra en database kan røpe verter og brukernavn, så punktet
 * krever samme nøkkel som den planlagte synken. Uten riktig nøkkel svarer
 * den 404 — ikke 401. Et punkt som svarer «feil nøkkel» forteller jo at
 * det finnes.
 */
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(forespørsel: Request) {
  const nokkel = new URL(forespørsel.url).searchParams.get("nokkel");
  if (!nokkel || nokkel !== process.env.SYNK_NOKKEL) {
    return new NextResponse("Not found", { status: 404 });
  }

  const start = Date.now();

  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({
      database: "svarer",
      brukteMs: Date.now() - start,
    });
  } catch (feil) {
    // Hele feilen, ikke en pyntet utgave. Det er hele poenget.
    const e = feil as { message?: string; code?: string; errno?: string };
    return NextResponse.json(
      {
        database: "svarer ikke",
        brukteMs: Date.now() - start,
        melding: e?.message ?? String(feil),
        kode: e?.code ?? e?.errno ?? null,
      },
      { status: 503 },
    );
  }
}
