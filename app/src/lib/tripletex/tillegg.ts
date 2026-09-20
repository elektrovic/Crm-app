/**
 * Tillegg til Tripletex.
 *
 * Modellen er den Halland selv foreslo, og den treffer Tripletex' egen:
 * tilleggsarbeid legges som et UNDERPROSJEKT under hovedprosjektet. Det er
 * ordet Tripletex bruker i sin egen hjelp, og det er derfra kontoret
 * fakturerer.
 *
 * Ett underprosjekt per hovedprosjekt, ikke ett per tillegg — ellers ville
 * en jobb med seks tillegg gitt seks prosjekter å holde styr på. Alle
 * tilleggene på samme jobb samles på det ene, med hver sin dokumentasjon.
 *
 * Bilder og signaturer lastes opp til HOVEDPROSJEKTETS dokumentarkiv, slik
 * at kontoret finner all dokumentasjon på jobben ett sted i stedet for å
 * lete i appen. Alternativet er underprosjektet — da ville signaturen ligget
 * rett ved fakturagrunnlaget i stedet. Si fra hvis dere heller vil ha det
 * slik; det er ett argument som endres i `sendTilleggTilTripletex`.
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { prosjekter, tillegg, vedlegg } from "@/db/schema";
import { tripletex, TripletexFeil } from "./client";

/** Navnet underprosjektet får. Alltid merket «Tillegg», som avtalt. */
export function underprosjektNavn(
  hovedNummer: string,
  hovedNavn: string,
  adresse: string | null,
): string {
  const sted = adresse?.trim() || hovedNavn;
  return `Tillegg – ${hovedNummer} ${sted}`;
}

/** Nummeret underprosjektet får: hovedprosjektets nummer med -T bak. */
export function underprosjektNummer(hovedNummer: string): string {
  return `${hovedNummer}-T`;
}

/**
 * Finner tilleggs-underprosjektet for et hovedprosjekt, og oppretter det
 * hvis det ikke finnes.
 *
 * Vi leter først — synken eller en kollega kan ha opprettet det allerede,
 * og to underprosjekter med samme navn hjelper ingen.
 */
export async function sikreUnderprosjekt(input: {
  hovedprosjektTripletexId: number;
  hovedNummer: string;
  hovedNavn: string;
  adresse: string | null;
}): Promise<number> {
  const onsketNummer = underprosjektNummer(input.hovedNummer);

  const eksisterende = await tripletex.underprosjekter(input.hovedprosjektTripletexId);
  const treff = eksisterende.find(
    (p) => p.number === onsketNummer || p.name.startsWith("Tillegg –"),
  );
  if (treff) return treff.id;

  const opprettet = await tripletex.opprettUnderprosjekt({
    hovedprosjektId: input.hovedprosjektTripletexId,
    navn: underprosjektNavn(input.hovedNummer, input.hovedNavn, input.adresse),
    nummer: onsketNummer,
  });

  return opprettet.id;
}

/**
 * Sender ett tillegg til Tripletex: sikrer underprosjektet, laster opp
 * bilde og signatur, og noterer hva som gikk bra.
 *
 * Feiler opplastingen av ett vedlegg, stopper vi ikke resten. Tillegget er
 * registrert uansett, og et manglende bilde er en mindre skade enn en
 * halvveis overføring ingen vet om.
 */
export async function sendTilleggTilTripletex(tenantId: string, tilleggId: string) {
  const rad = await db.query.tillegg.findFirst({
    where: and(eq(tillegg.id, tilleggId), eq(tillegg.tenantId, tenantId)),
  });
  if (!rad) throw new Error(`Ukjent tillegg ${tilleggId}`);

  const prosjekt = await db.query.prosjekter.findFirst({
    where: eq(prosjekter.id, rad.prosjektId),
  });
  if (!prosjekt) throw new Error(`Ukjent prosjekt for tillegg ${tilleggId}`);

  const underprosjektId = await sikreUnderprosjekt({
    hovedprosjektTripletexId: prosjekt.tripletexProjectId,
    hovedNummer: prosjekt.nummer,
    hovedNavn: prosjekt.navn,
    adresse: prosjekt.adresse,
  });

  await db
    .update(tillegg)
    .set({ tripletexUnderprosjektId: underprosjektId, status: "sendt", feilmelding: null })
    .where(eq(tillegg.id, rad.id));

  // Dokumentasjonen: bilde først, så signaturen. Den legges på
  // hovedprosjektet, ikke underprosjektet — all dokumentasjon på jobben
  // samlet ett sted.
  const vedleggIder = [rad.bildeId, rad.signaturId].filter((v): v is string => v !== null);
  let lastetOpp = 0;

  for (const id of vedleggIder) {
    try {
      await lastOppVedlegg(tenantId, id, prosjekt.tripletexProjectId, rad.navn);
      lastetOpp++;
    } catch (feil) {
      const melding = feil instanceof Error ? feil.message : "Ukjent feil";
      await db
        .update(vedlegg)
        .set({ tripletexFeilmelding: melding })
        .where(eq(vedlegg.id, id));
      console.error("Vedlegg gikk ikke opp til Tripletex", { vedlegg: id, feil });
    }
  }

  return { underprosjektId, lastetOpp, avTotalt: vedleggIder.length };
}

/** Laster ett vedlegg opp til et prosjekts dokumentarkiv i Tripletex. */
export async function lastOppVedlegg(
  tenantId: string,
  vedleggId: string,
  tripletexProsjektId: number,
  beskrivelse: string,
): Promise<void> {
  const rad = await db.query.vedlegg.findFirst({
    where: and(eq(vedlegg.id, vedleggId), eq(vedlegg.tenantId, tenantId)),
  });
  if (!rad) throw new Error(`Ukjent vedlegg ${vedleggId}`);
  if (rad.tripletexLastetOpp) return; // allerede oppe

  // Innholdet er ryddet bort etter oppbevaringstiden. Det skjer bare for
  // filer Tripletex allerede har bekreftet, så det er ingenting å gjøre —
  // men vi later ikke som om vi lastet opp noe.
  if (rad.data === null) {
    throw new Error(
      `Vedlegg ${vedleggId} er ryddet bort lokalt og kan ikke lastes opp på nytt.`,
    );
  }

  const filnavn = lagFilnavn(rad.slag, beskrivelse, rad.mimetype, rad.opprettet);

  await tripletex.lastOppVedlegg({
    objekttype: "PROJECT",
    objektId: tripletexProsjektId,
    filnavn,
    mimetype: rad.mimetype,
    innhold: Buffer.from(rad.data, "base64"),
  });

  await db
    .update(vedlegg)
    .set({ tripletexLastetOpp: new Date(), tripletexFeilmelding: null })
    .where(eq(vedlegg.id, rad.id));
}

/**
 * Filnavnet kontoret ser i Tripletex.
 *
 * Datoen først gjør at vedleggene sorterer seg selv kronologisk, og
 * beskrivelsen gjør at man vet hva bildet viser uten å åpne det.
 */
export function lagFilnavn(
  slag: string,
  beskrivelse: string,
  mimetype: string,
  opprettet: Date,
): string {
  const dato = opprettet.toISOString().slice(0, 10);
  const etternavn =
    mimetype === "image/png" ? "png" : mimetype === "image/webp" ? "webp" : "jpg";

  const rensket = beskrivelse
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "o")
    .replace(/[å]/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const merkelapp = slag === "signatur" ? "signatur" : "bilde";
  return `${dato}-${merkelapp}-${rensket || "tillegg"}.${etternavn}`;
}

export { TripletexFeil };
