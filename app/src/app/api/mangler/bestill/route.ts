/**
 * «Send lista til daglig leder».
 *
 * Lager en ekte bestilling av de åpne manglene: en rad i `bestillinger`
 * med linjer, og sender den ut via den transporten som er satt opp.
 *
 * Bestillingen lagres FØR den sendes. Da har vi den selv om utsendingen
 * feiler, og montøren slipper å skrive lista på nytt.
 */
import { NextResponse } from "next/server";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bestillinger, bestillingslinjer, mangler, prosjekter } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { hentMangler } from "@/lib/data/prosjekt";
import { loggEndring } from "@/lib/endringslogg";
import {
  finnMangler,
  linjerUtenVarenummer,
  nesteBestillingsnummer,
  type Bestillingsdokument,
  type Enhet,
} from "@/lib/ahlsell/bestilling";
import { sendBestilling, TransportFeil } from "@/lib/ahlsell/transport";

const Skjema = z.object({
  prosjektId: z.uuid(),
  onsketLeveringsdato: z.iso.date().nullish(),
  merknad: z.string().max(500).nullish(),
});

export const POST = endepunkt(Skjema, async ({ okt, data, request }) => {
  const prosjekt = await db.query.prosjekter.findFirst({
    where: and(eq(prosjekter.id, data.prosjektId), eq(prosjekter.tenantId, okt.tenantId)),
  });
  if (!prosjekt) {
    return NextResponse.json({ feil: "Ukjent prosjekt." }, { status: 400 });
  }

  const apne = (await hentMangler(okt, prosjekt.id)).filter((m) => !m.bestilt);
  if (apne.length === 0) {
    return NextResponse.json(
      { feil: "Ingenting å bestille på dette prosjektet." },
      { status: 400 },
    );
  }

  const bestillingsnummer = await nesteNummer(okt.tenantId);

  const dokument: Bestillingsdokument = {
    bestillingsnummer,
    kundenummer: process.env.GROSSIST_KUNDENUMMER ?? null,
    prosjektnummer: prosjekt.nummer,
    prosjektnavn: prosjekt.navn,
    leveringsadresse: prosjekt.adresse,
    onsketLeveringsdato: data.onsketLeveringsdato ?? null,
    bestiltAv: okt.navn,
    merknad: data.merknad ?? null,
    linjer: apne.map((m, i) => ({
      linjenummer: i + 1,
      beskrivelse: m.tekst,
      efoNummer: m.efoNummer,
      antall: lesAntall(m.antall),
      enhet: (m.enhet as Enhet) ?? "STK",
    })),
  };

  const feil = finnMangler(dokument);
  if (feil.length > 0) {
    return NextResponse.json({ feil: feil.join(" ") }, { status: 400 });
  }

  // Lagres først, sendes etterpå.
  const [bestilling] = await db
    .insert(bestillinger)
    .values({
      tenantId: okt.tenantId,
      bestillingsnummer,
      prosjektId: prosjekt.id,
      bestiltAv: okt.id,
      kundenummer: dokument.kundenummer,
      leveringsadresse: dokument.leveringsadresse,
      onsketLeveringsdato: dokument.onsketLeveringsdato,
      merknad: dokument.merknad,
      status: "kladd",
    })
    .returning();

  if (!bestilling) {
    return NextResponse.json({ feil: "Klarte ikke å lagre bestillingen." }, { status: 500 });
  }

  await db.insert(bestillingslinjer).values(
    dokument.linjer.map((l, i) => ({
      tenantId: okt.tenantId,
      bestillingId: bestilling.id,
      mangelId: apne[i]?.id ?? null,
      beskrivelse: l.beskrivelse,
      efoNummer: l.efoNummer ?? null,
      antall: String(l.antall),
      enhet: l.enhet,
      sortering: l.linjenummer,
    })),
  );

  try {
    const kvittering = await sendBestilling(dokument);

    await db
      .update(bestillinger)
      .set({
        status: "sendt",
        sendt: new Date(),
        grossistOrdrenummer: kvittering.grossistOrdrenummer,
        feilmelding: null,
      })
      .where(eq(bestillinger.id, bestilling.id));

    // Manglene krysses av som bestilt nå som de faktisk er det.
    await db
      .update(mangler)
      .set({ bestilt: true, bestiltTidspunkt: new Date() })
      .where(
        and(
          eq(mangler.tenantId, okt.tenantId),
          inArray(
            mangler.id,
            apne.map((m) => m.id),
          ),
        ),
      );

    await loggEndring(okt, {
      handling: "bestilling.sendt",
      tabell: "bestillinger",
      radId: bestilling.id,
      etter: {
        bestillingsnummer,
        prosjekt: prosjekt.nummer,
        antallLinjer: dokument.linjer.length,
        vei: kvittering.vei,
      },
      ipAdresse: ipFra(request),
    });

    return NextResponse.json({
      sendt: true,
      bestillingsnummer,
      antall: dokument.linjer.length,
      utenVarenummer: linjerUtenVarenummer(dokument).length,
    });
  } catch (feilVedSending) {
    const melding =
      feilVedSending instanceof Error ? feilVedSending.message : "Ukjent feil ved sending.";

    await db
      .update(bestillinger)
      .set({ status: "kladd", feilmelding: melding })
      .where(eq(bestillinger.id, bestilling.id));

    console.error("Bestillingen gikk ikke ut", {
      bestillingsnummer,
      prosjekt: prosjekt.nummer,
      feil: feilVedSending,
    });

    const kanProvesIgjen =
      feilVedSending instanceof TransportFeil ? feilVedSending.kanProvesIgjen : true;

    return NextResponse.json(
      {
        feil:
          `Bestilling ${bestillingsnummer} er lagret, men gikk ikke ut. ` +
          "Prøv igjen, eller ring kontoret.",
      },
      { status: kanProvesIgjen ? 502 : 503 },
    );
  }
});

/** Antall som tall. Montøren skriver «10», «2 stk» eller ingenting. */
function lesAntall(raa: string | null): number {
  if (!raa) return 1;
  const treff = /(\d+(?:[.,]\d+)?)/.exec(raa);
  if (!treff) return 1;
  const n = Number(treff[1]!.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Neste løpenummer for inneværende år. */
async function nesteNummer(tenantId: string): Promise<string> {
  const aar = new Date().getFullYear();
  const prefiks = `B-${aar}-`;

  const [siste] = await db
    .select({ nummer: bestillinger.bestillingsnummer })
    .from(bestillinger)
    .where(
      and(
        eq(bestillinger.tenantId, tenantId),
        like(bestillinger.bestillingsnummer, `${prefiks}%`),
      ),
    )
    .orderBy(desc(bestillinger.bestillingsnummer))
    .limit(1);

  const forrige = siste ? Number(siste.nummer.slice(prefiks.length)) : 0;
  return nesteBestillingsnummer(aar, Number.isFinite(forrige) ? forrige : 0);
}
