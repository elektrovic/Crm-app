/**
 * Tillegg: arbeid utover tilbudet, godkjent av kunden på stedet.
 *
 * Signaturen er dokumentasjonen. Uten den er tillegget en påstand, og
 * derfor lagres signatur, hvem som signerte og tidspunktet i samme
 * transaksjon som selve tillegget.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { prosjekter, tillegg, vedlegg } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { loggEndring } from "@/lib/endringslogg";
import { sendTilleggTilTripletex } from "@/lib/tripletex/tillegg";

/** 4 MB base64 ≈ 3 MB fil. Bilder komprimeres i nettleseren først. */
const MAKS_BASE64 = 4 * 1024 * 1024;

const Fil = z.object({
  mimetype: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(1).max(MAKS_BASE64),
});

const Skjema = z.object({
  klientNokkel: z.string().min(8).max(64),
  prosjektId: z.uuid(),
  navn: z.string().min(1).max(300),
  enhet: z.string().max(120).nullish(),
  antall: z.number().positive().max(9999),
  enhetspris: z.number().nonnegative().max(1_000_000),
  kommentar: z.string().max(2000).nullish(),
  bilde: Fil.nullish(),
  /** Signaturen er påkrevd — et tillegg uten den er ikke dokumentert. */
  signatur: Fil,
  signertAv: z.string().min(1).max(200),
});

export const POST = endepunkt(Skjema, async ({ okt, data, request }) => {
  // Idempotens: køen kan sende samme linje på nytt etter dårlig nett.
  const fraFor = await db.query.tillegg.findFirst({
    where: and(eq(tillegg.tenantId, okt.tenantId), eq(tillegg.klientNokkel, data.klientNokkel)),
  });
  if (fraFor) {
    return NextResponse.json({ id: fraFor.id, gjentakelse: true });
  }

  const prosjekt = await db.query.prosjekter.findFirst({
    where: and(eq(prosjekter.id, data.prosjektId), eq(prosjekter.tenantId, okt.tenantId)),
  });
  if (!prosjekt) {
    return NextResponse.json({ feil: "Ukjent prosjekt." }, { status: 400 });
  }

  const lagreFil = async (fil: z.infer<typeof Fil>, slag: "bilde" | "signatur") => {
    const [rad] = await db
      .insert(vedlegg)
      .values({
        tenantId: okt.tenantId,
        prosjektId: prosjekt.id,
        slag,
        mimetype: fil.mimetype,
        data: fil.base64,
        storrelse: Math.floor((fil.base64.length * 3) / 4),
        lastetOppAv: okt.id,
      })
      .returning({ id: vedlegg.id });
    return rad?.id ?? null;
  };

  const signaturId = await lagreFil(data.signatur, "signatur");
  const bildeId = data.bilde ? await lagreFil(data.bilde, "bilde") : null;

  const [rad] = await db
    .insert(tillegg)
    .values({
      tenantId: okt.tenantId,
      prosjektId: prosjekt.id,
      ansattId: okt.id,
      navn: data.navn,
      enhet: data.enhet ?? null,
      antall: String(data.antall),
      enhetspris: String(data.enhetspris),
      kommentar: data.kommentar ?? null,
      bildeId,
      signaturId,
      signertAv: data.signertAv,
      signertTidspunkt: new Date(),
      klientNokkel: data.klientNokkel,
      status: "i_ko",
    })
    .returning();

  await loggEndring(okt, {
    handling: "tillegg.registrert",
    tabell: "tillegg",
    radId: rad?.id,
    etter: {
      prosjekt: prosjekt.nummer,
      navn: data.navn,
      antall: data.antall,
      enhetspris: data.enhetspris,
      signertAv: data.signertAv,
    },
    ipAdresse: ipFra(request),
  });

  // Tillegget er registrert hos oss nå. Overføringen til Tripletex kommer
  // etterpå, og får ikke lov til å velte kvitteringen montøren venter på —
  // står han hos kunden med signaturpennen, skal han ikke vente på at et
  // underprosjekt blir opprettet.
  if (!rad) {
    return NextResponse.json({ feil: "Klarte ikke å lagre tillegget." }, { status: 500 });
  }

  try {
    const resultat = await sendTilleggTilTripletex(okt.tenantId, rad.id);

    await loggEndring(okt, {
      handling: "tillegg.sendtTilTripletex",
      tabell: "tillegg",
      radId: rad.id,
      etter: {
        underprosjekt: resultat.underprosjektId,
        vedleggOpplastet: `${resultat.lastetOpp} av ${resultat.avTotalt}`,
      },
      ipAdresse: ipFra(request),
    });

    return NextResponse.json({
      id: rad.id,
      status: "sendt",
      underprosjektId: resultat.underprosjektId,
      vedleggOpplastet: resultat.lastetOpp,
    });
  } catch (feil) {
    const melding = feil instanceof Error ? feil.message : "Ukjent feil mot Tripletex.";
    await db
      .update(tillegg)
      .set({ status: "feilet", feilmelding: melding })
      .where(eq(tillegg.id, rad.id));

    console.error("Tillegget nådde ikke Tripletex", { tillegg: rad.id, feil });

    // Tillegget ER registrert, med signatur og bilde. Det er bare
    // overføringen som feilet, og den kan kjøres på nytt fra admin.
    return NextResponse.json({
      id: rad.id,
      status: "registrert",
      advarsel:
        "Tillegget er registrert med signatur, men nådde ikke Tripletex ennå. " +
        "Kontoret ser det i lista over feilede overføringer.",
    });
  }
});
