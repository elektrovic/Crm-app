/**
 * Synk mot Tripletex.
 *
 * Holder prosjekter, aktiviteter og ansatte oppdatert, slik at montøren
 * ikke får opp fjorårets portefølje når han skal føre timer.
 *
 * To prinsipper:
 *
 * 1. Tripletex er fasit. Vi speiler, vi retter aldri på deres data.
 * 2. Synken skal aldri slette noe. Et prosjekt som forsvinner fra svaret
 *    markeres som inaktivt — vi har timeføringer som peker på det, og en
 *    kaskadesletting ville tatt historikken med seg.
 */
import "server-only";
import { and, eq, isNotNull, isNull, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { aktiviteter, ansatte, prosjekter, type Avdeling } from "@/db/schema";
import { geokod, GeokodingFeil } from "@/lib/geo/kartverket";
import { ryddGamleVedlegg, type Oppryddingsresultat } from "@/lib/vedlegg/opprydding";
import { tripletex } from "./client";

export type Synkresultat = {
  prosjekter: { nye: number; oppdatert: number; deaktivert: number };
  aktiviteter: { nye: number; oppdatert: number };
  ansatte: { koblet: number; ukjente: string[] };
  geokoding: { treff: number; bom: number; gjenstaar: number };
  vedleggsopprydding: Oppryddingsresultat;
};

/**
 * Avdeling utledes ikke automatisk — Tripletex vet ikke om Halland deler
 * inn i elektro, lås og eiendomspleie. Nye prosjekter får en standard, og
 * kontoret retter den under Admin. Vi overskriver aldri en avdeling noen
 * har satt manuelt.
 */
const STANDARD_AVDELING: Avdeling = "Elektro";

export async function synkProsjekter(tenantId: string) {
  const fra = await tripletex.prosjekter({ isClosed: false });
  const naa = new Date();

  let nye = 0;
  let oppdatert = 0;

  for (const p of fra) {
    const adresse = [
      p.deliveryAddress?.addressLine1,
      [p.deliveryAddress?.postalCode, p.deliveryAddress?.city].filter(Boolean).join(" "),
    ]
      .filter((d) => d && d.length > 0)
      .join(", ");

    const eksisterende = await db.query.prosjekter.findFirst({
      where: and(
        eq(prosjekter.tenantId, tenantId),
        eq(prosjekter.tripletexProjectId, p.id),
      ),
    });

    if (eksisterende) {
      await db
        .update(prosjekter)
        .set({
          nummer: p.number,
          navn: p.displayName ?? p.name,
          kunde: p.customer?.name ?? eksisterende.kunde,
          adresse: adresse || eksisterende.adresse,
          aktiv: true,
          sistSynket: naa,
          // Avdeling og farge er satt av kontoret — de røres ikke.
        })
        .where(eq(prosjekter.id, eksisterende.id));
      oppdatert++;
    } else {
      await db.insert(prosjekter).values({
        tenantId,
        tripletexProjectId: p.id,
        nummer: p.number,
        navn: p.displayName ?? p.name,
        kunde: p.customer?.name ?? null,
        adresse: adresse || null,
        avdeling: STANDARD_AVDELING,
        sistSynket: naa,
      });
      nye++;
    }
  }

  // Prosjekter som ikke lenger kommer fra Tripletex deaktiveres, ikke slettes.
  const idFraTripletex = fra.map((p) => p.id);
  const deaktivert = idFraTripletex.length
    ? await db
        .update(prosjekter)
        .set({ aktiv: false, sistSynket: naa })
        .where(
          and(
            eq(prosjekter.tenantId, tenantId),
            eq(prosjekter.aktiv, true),
            notInArray(prosjekter.tripletexProjectId, idFraTripletex),
          ),
        )
        .returning({ id: prosjekter.id })
    : [];

  return { nye, oppdatert, deaktivert: deaktivert.length };
}

export async function synkAktiviteter(tenantId: string) {
  const fra = await tripletex.aktiviteter();
  const naa = new Date();

  let nye = 0;
  let oppdatert = 0;

  for (const a of fra) {
    const eksisterende = await db.query.aktiviteter.findFirst({
      where: and(
        eq(aktiviteter.tenantId, tenantId),
        eq(aktiviteter.tripletexActivityId, a.id),
      ),
    });

    if (eksisterende) {
      await db
        .update(aktiviteter)
        .set({
          navn: a.name,
          nummer: a.number ?? null,
          fakturerbar: a.isChargeable ?? true,
          aktiv: true,
          sistSynket: naa,
        })
        .where(eq(aktiviteter.id, eksisterende.id));
      oppdatert++;
    } else {
      await db.insert(aktiviteter).values({
        tenantId,
        tripletexActivityId: a.id,
        navn: a.name,
        nummer: a.number ?? null,
        fakturerbar: a.isChargeable ?? true,
        sistSynket: naa,
      });
      nye++;
    }
  }

  const idFraTripletex = fra.map((a) => a.id);
  if (idFraTripletex.length > 0) {
    await db
      .update(aktiviteter)
      .set({ aktiv: false })
      .where(
        and(
          eq(aktiviteter.tenantId, tenantId),
          notInArray(aktiviteter.tripletexActivityId, idFraTripletex),
        ),
      );
  }

  return { nye, oppdatert };
}

/**
 * Kobler ansatte til Tripletex på e-post.
 *
 * Vi oppretter aldri en ansatt her. En bruker skal legges inn bevisst av
 * ledelsen — det er de som bestemmer hvem som får bruke appen, ikke hvem
 * som tilfeldigvis finnes i Tripletex.
 */
export async function synkAnsatte(tenantId: string) {
  const fra = await tripletex.ansatte();
  const våre = await db.query.ansatte.findMany({
    where: eq(ansatte.tenantId, tenantId),
  });

  let koblet = 0;
  const ukjente: string[] = [];

  for (const v of våre) {
    if (v.tripletexEmployeeId !== null) continue;

    const treff = fra.find((t) => t.email?.toLowerCase() === v.epost.toLowerCase());
    if (treff) {
      await db
        .update(ansatte)
        .set({ tripletexEmployeeId: treff.id })
        .where(eq(ansatte.id, v.id));
      koblet++;
    } else {
      ukjente.push(v.epost);
    }
  }

  return { koblet, ukjente };
}

/**
 * Slår opp koordinater for prosjekter som mangler dem.
 *
 * Uten koordinater kan ikke ABAX-forslagene matche et bilstopp mot
 * prosjektet, og montøren må føre timene fra hukommelsen.
 *
 * Vi prøver hver adresse én gang og noterer forsøket, uansett om det traff.
 * Ellers ville synken spurt Kartverket om den samme umulige adressen hver
 * eneste time.
 *
 * Hvert oppslag tar et par hundre millisekunder, og på en plattform med
 * kort tidsgrense for funksjoner er det dette steget som sprenger budsjettet.
 * Derfor stopper vi på klokka, ikke bare på antall: resten står igjen til
 * neste kjøring, og adressene er uansett merket slik at ingen prøves to
 * ganger. Kjører synken hver time, tar den unna 240 adresser i døgnet — langt
 * mer enn en portefølje vokser.
 */
export async function geokodProsjekter(
  tenantId: string,
  { maksOppslag = 10, tidsbudsjettMs = 8_000 } = {},
) {
  const kandidater = await db
    .select({ id: prosjekter.id, adresse: prosjekter.adresse })
    .from(prosjekter)
    .where(
      and(
        eq(prosjekter.tenantId, tenantId),
        eq(prosjekter.aktiv, true),
        isNotNull(prosjekter.adresse),
        isNull(prosjekter.lat),
        isNull(prosjekter.geokodetForsokt),
      ),
    )
    .limit(maksOppslag);

  const stopper = Date.now() + tidsbudsjettMs;
  let treff = 0;
  let bom = 0;
  let gjenstaar = 0;

  for (const p of kandidater) {
    if (!p.adresse) continue;

    // Ut av tid. Resten står igjen — de er ikke merket som forsøkt, så
    // neste kjøring tar dem.
    if (Date.now() > stopper) {
      gjenstaar = kandidater.length - treff - bom;
      break;
    }

    try {
      const punkt = await geokod(p.adresse);
      if (punkt) {
        await db
          .update(prosjekter)
          .set({
            lat: punkt.lat.toFixed(6),
            lon: punkt.lon.toFixed(6),
            geokodetForsokt: new Date(),
          })
          .where(eq(prosjekter.id, p.id));
        treff++;
      } else {
        // Kartverket kjenner ikke adressen. Vi noterer forsøket og går
        // videre — vi gjetter aldri på en posisjon.
        await db
          .update(prosjekter)
          .set({ geokodetForsokt: new Date() })
          .where(eq(prosjekter.id, p.id));
        bom++;
      }
    } catch (feil) {
      // En teknisk feil skal ikke merkes som forsøkt, så adressen prøves
      // på nytt ved neste synk.
      if (feil instanceof GeokodingFeil && feil.kanProvesIgjen) {
        console.warn("Geokoding utsatt", { prosjekt: p.id, feil: feil.message });
      } else {
        console.error("Geokoding feilet", { prosjekt: p.id, feil });
        await db
          .update(prosjekter)
          .set({ geokodetForsokt: new Date() })
          .where(eq(prosjekter.id, p.id));
      }
      bom++;
    }
  }

  return { treff, bom, gjenstaar };
}

export async function synkAlt(tenantId: string): Promise<Synkresultat> {
  const prosjektResultat = await synkProsjekter(tenantId);
  return {
    prosjekter: prosjektResultat,
    aktiviteter: await synkAktiviteter(tenantId),
    ansatte: await synkAnsatte(tenantId),
    // Kjøres til slutt, så nye prosjekter fra denne runden får koordinater.
    geokoding: await geokodProsjekter(tenantId),
    // Rydder bort lokale bildekopier Tripletex har bekreftet at de har.
    vedleggsopprydding: await ryddGamleVedlegg(tenantId),
  };
}

/** Aktivitetene montøren kan velge mellom, med avdelingens standard først. */
export async function hentAktiviteter(tenantId: string, avdeling: Avdeling) {
  const rader = await db
    .select()
    .from(aktiviteter)
    .where(and(eq(aktiviteter.tenantId, tenantId), eq(aktiviteter.aktiv, true)))
    .orderBy(aktiviteter.navn);

  return rader
    .map((a) => ({
      id: a.tripletexActivityId,
      navn: a.navn,
      erStandard: a.standardForAvdeling === avdeling,
    }))
    .sort((a, b) => {
      if (a.erStandard !== b.erStandard) return a.erStandard ? -1 : 1;
      return a.navn.localeCompare(b.navn, "nb-NO");
    });
}
