/**
 * Geokoding mot Kartverket.
 *
 * ABAX-timeforslagene sammenligner hvor bilen sto med hvor prosjektet er.
 * Tripletex gir oss bare adressen som tekst, så uten dette steget har
 * prosjektene ingen posisjon å sammenlignes mot — og forslaget uteblir.
 *
 * Kartverkets adresse-API er åpent og gratis, uten nøkkel, og dekker alle
 * offisielle norske adresser fra matrikkelen. Det er riktig kilde her:
 * ingen leverandøravtale, ingen kvote å passe på, og norske adresser er
 * det eneste vi trenger.
 *
 * Treffer vi ikke, lar vi prosjektet stå uten koordinater. Da mister vi
 * timeforslaget for det ene prosjektet — vi gjetter aldri på en posisjon,
 * for et forslag på feil prosjekt er verre enn ingen forslag.
 */
import "server-only";
import { delOppAdresse, tilSokestreng } from "./adresse";

const BASE = process.env.KARTVERKET_URL ?? "https://ws.geonorge.no/adresser/v1/sok";

export type Koordinat = { lat: number; lon: number };

export class GeokodingFeil extends Error {
  constructor(
    message: string,
    readonly kanProvesIgjen: boolean,
  ) {
    super(message);
    this.name = "GeokodingFeil";
  }
}

type KartverketSvar = {
  adresser?: {
    adressetekst?: string;
    postnummer?: string;
    representasjonspunkt?: { lat?: number; lon?: number; epsg?: string };
  }[];
};

/**
 * Slår opp én adresse. Returnerer null når Kartverket ikke kjenner den.
 *
 * Kaster bare ved tekniske feil, slik at en synk av hundre prosjekter ikke
 * stopper fordi ett av dem har en adresse med skrivefeil.
 */
export async function geokod(adresse: string): Promise<Koordinat | null> {
  const deler = delOppAdresse(adresse);
  if (!deler) return null;

  const url = new URL(BASE);
  url.searchParams.set("sok", tilSokestreng(deler));
  url.searchParams.set("treffPerSide", "1");
  // Vi trenger bare punktet, ikke hele matrikkelraden.
  url.searchParams.set("asciiKompatibel", "true");

  let svar: Response;
  try {
    svar = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch (feil) {
    throw new GeokodingFeil(
      `Fikk ikke kontakt med Kartverket: ${feil instanceof Error ? feil.message : "ukjent feil"}`,
      true,
    );
  }

  if (!svar.ok) {
    throw new GeokodingFeil(`Kartverket svarte ${svar.status}.`, svar.status >= 500);
  }

  const data = (await svar.json()) as KartverketSvar;
  const punkt = data.adresser?.[0]?.representasjonspunkt;

  if (typeof punkt?.lat !== "number" || typeof punkt?.lon !== "number") {
    return null;
  }

  // Norge ligger grovt mellom 57–72 nord og 4–32 øst. Et svar utenfor det
  // er ikke en norsk adresse, uansett hva API-et mener.
  if (punkt.lat < 57 || punkt.lat > 72 || punkt.lon < 4 || punkt.lon > 32) {
    return null;
  }

  return { lat: punkt.lat, lon: punkt.lon };
}
