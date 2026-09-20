/**
 * Kryptering av hemmeligheter som må lagres i databasen.
 *
 * Brukes på de personlige Tripletex-tokenene. Et slikt token gir tilgang
 * til å føre timer i den ansattes navn, så det skal ikke ligge i klartekst
 * i en tabell noen kan ta backup av.
 *
 * AES-256-GCM: krypterer og autentiserer i samme operasjon, slik at en rad
 * som er endret i basen ikke lar seg dekryptere i det hele tatt — den feiler
 * heller enn å gi fra seg noe som ser riktig ut.
 *
 * Formatet på en lagret verdi er `v1.<iv>.<tag>.<chiffer>`, alt i base64url.
 * Versjonsprefikset gjør at nøkkelrotasjon eller bytte av algoritme senere
 * kan gjøres uten å gjette på hva gamle rader inneholder.
 */
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

const ALGORITME = "aes-256-gcm";
const VERSJON = "v1";
const IV_LENGDE = 12; // 96 bit, anbefalt for GCM
const TAG_LENGDE = 16;

export class KryptoFeil extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KryptoFeil";
  }
}

/**
 * Nøkkelen leses fra miljøet, ikke fra databasen — den som får tak i en
 * databasedump skal ikke også få nøkkelen.
 *
 * Genereres med: openssl rand -base64 32
 */
function hentNokkel(): Buffer {
  const raa = process.env.KRYPTERINGSNOKKEL;
  if (!raa) {
    throw new KryptoFeil(
      "KRYPTERINGSNOKKEL mangler i miljøet. Generer én med: openssl rand -base64 32",
    );
  }

  const nokkel = Buffer.from(raa, "base64");
  if (nokkel.length !== 32) {
    throw new KryptoFeil(
      `KRYPTERINGSNOKKEL må være 32 byte base64-kodet, fikk ${nokkel.length}. ` +
        "Generer en ny med: openssl rand -base64 32",
    );
  }
  return nokkel;
}

/** Sant når kryptering er satt opp. Brukes til å feile tidlig ved oppstart. */
export function kryptoErSattOpp(): boolean {
  try {
    hentNokkel();
    return true;
  } catch {
    return false;
  }
}

export function krypter(klartekst: string): string {
  if (klartekst.length === 0) throw new KryptoFeil("Ingenting å kryptere.");

  const nokkel = hentNokkel();
  const iv = randomBytes(IV_LENGDE);
  const chiffer = createCipheriv(ALGORITME, nokkel, iv);

  const kryptert = Buffer.concat([chiffer.update(klartekst, "utf8"), chiffer.final()]);
  const tag = chiffer.getAuthTag();

  return [
    VERSJON,
    iv.toString("base64url"),
    tag.toString("base64url"),
    kryptert.toString("base64url"),
  ].join(".");
}

export function dekrypter(lagret: string): string {
  const deler = lagret.split(".");
  if (deler.length !== 4) {
    throw new KryptoFeil("Den lagrede verdien har ikke forventet format.");
  }

  const [versjon, ivB64, tagB64, chifferB64] = deler as [string, string, string, string];
  if (versjon !== VERSJON) {
    throw new KryptoFeil(`Ukjent krypteringsversjon «${versjon}».`);
  }

  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  if (iv.length !== IV_LENGDE || tag.length !== TAG_LENGDE) {
    throw new KryptoFeil("Ugyldig lengde på iv eller autentiseringstag.");
  }

  const dechiffer = createDecipheriv(ALGORITME, hentNokkel(), iv);
  dechiffer.setAuthTag(tag);

  try {
    return Buffer.concat([
      dechiffer.update(Buffer.from(chifferB64, "base64url")),
      dechiffer.final(),
    ]).toString("utf8");
  } catch {
    // GCM avviser en rad som er endret etter at den ble skrevet. Det er
    // meningen — vi gir aldri fra oss noe som ser riktig ut, men ikke er det.
    throw new KryptoFeil(
      "Klarte ikke å dekryptere. Enten er nøkkelen en annen enn da verdien " +
        "ble lagret, eller så er raden endret.",
    );
  }
}

/**
 * Sammenligner to hemmeligheter uten å lekke hvor de skiller seg.
 * En vanlig `===` bruker litt kortere tid jo tidligere forskjellen ligger.
 */
export function likeHemmeligheter(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
