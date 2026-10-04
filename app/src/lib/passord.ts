/**
 * Passord for de som ikke logger inn med Microsoft.
 *
 * Vi lagrer aldri passordet. Vi lagrer scrypt av det, med et tilfeldig
 * salt per bruker, slik at to som velger samme passord får ulike rader —
 * og slik at en stjålet base ikke er en liste over passord.
 *
 * scrypt er valgt fordi den ligger i Node fra før. Alternativene (bcrypt,
 * argon2) er gode, men de er C-pakker som må bygges ved installasjon, og
 * en avhengighet som kan feile under utrulling er en avhengighet som en
 * dag gjør det. scrypt med disse parameterne er mer enn sterk nok til
 * formålet.
 *
 * Formatet er selvbeskrivende: `scrypt$N$r$p$salt$hash`. Da kan
 * parameterne skrus opp senere uten at gamle passord slutter å virke —
 * hver rad bærer sine egne.
 */
import { randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * promisify() mister overloaden som tar imot parametere, så den er
 * skrevet ut her. Uten parameterne ville scrypt brukt standardkosten,
 * som er for billig for passord.
 */
function scryptAsync(
  passord: string,
  salt: Buffer,
  lengde: number,
  valg: ScryptOptions,
): Promise<Buffer> {
  return new Promise((ja, nei) => {
    scrypt(passord, salt, lengde, valg, (feil, nokkel) =>
      feil ? nei(feil) : ja(nokkel),
    );
  });
}

/**
 * Kostnaden. N=16384 tar rundt 50 ms på maskinvaren Netlify kjører på —
 * nok til å gjøre gjetting dyrt, lite nok til at innloggingen ikke føles
 * treg.
 */
const N = 16_384;
const r = 8;
const p = 1;
const SALTLENGDE = 16;
const HASHLENGDE = 32;

export async function lagHash(passord: string): Promise<string> {
  const salt = randomBytes(SALTLENGDE);
  const hash = await scryptAsync(passord.normalize("NFKC"), salt, HASHLENGDE, {
    N,
    r,
    p,
  });

  return ["scrypt", N, r, p, salt.toString("base64"), hash.toString("base64")].join("$");
}

/**
 * Sant bare når passordet stemmer.
 *
 * Sammenligningen er tidskonstant. Uten det kan en angriper lese seg fram
 * til riktig hash tegn for tegn ved å måle hvor lang tid svaret tar.
 *
 * Alt som ikke går opp gir `false`, ikke et unntak. En rad med ødelagt
 * format skal være en innlogging som ikke virker, ikke en femhundrefeil
 * som avslører at raden finnes.
 */
export async function sjekkPassord(passord: string, lagret: string | null): Promise<boolean> {
  if (!lagret) return false;

  const deler = lagret.split("$");
  if (deler.length !== 6 || deler[0] !== "scrypt") return false;

  const [, nTekst, rTekst, pTekst, saltB64, hashB64] = deler;
  const nn = Number(nTekst);
  const rr = Number(rTekst);
  const pp = Number(pTekst);
  if (!Number.isInteger(nn) || !Number.isInteger(rr) || !Number.isInteger(pp)) return false;
  // Et absurd høyt N i en manipulert rad skal ikke kunne låse serveren.
  if (nn > 1_048_576 || rr > 32 || pp > 16) return false;

  const salt = Buffer.from(saltB64 ?? "", "base64");
  const fasit = Buffer.from(hashB64 ?? "", "base64");
  if (salt.length === 0 || fasit.length === 0) return false;

  try {
    const hash = await scryptAsync(passord.normalize("NFKC"), salt, fasit.length, {
      N: nn,
      r: rr,
      p: pp,
      // scrypt trenger mer minne enn standardgrensen når N er høy.
      maxmem: 256 * nn * rr,
    });
    return timingSafeEqual(hash, fasit);
  } catch {
    return false;
  }
}

/**
 * Tegnene i et foreslått passord.
 *
 * Uten O, 0, I, l og 1. De blandes når noen leser et passord høyt over
 * telefon eller skriver det av fra en lapp, og hver forveksling er en
 * henvendelse til deg.
 */
const TEGN = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/**
 * Et midlertidig passord, delt i grupper på fire.
 *
 * Grupperingen er der fordi det skal leses opp og skrives av. Tolv tegn
 * fra dette alfabetet er langt utenfor rekkevidde for gjetting, og
 * passordet skal byttes ved første innlogging uansett.
 */
export function foreslaPassord(lengde = 12): string {
  let ut = "";
  for (let i = 0; i < lengde; i++) {
    ut += TEGN[randomInt(TEGN.length)];
  }
  return (ut.match(/.{1,4}/g) ?? [ut]).join("-");
}

export const MINSTE_LENGDE = 10;

/**
 * Kravene til et passord brukeren velger selv.
 *
 * Lengde, ikke tegnklasser. Krav om «stor bokstav, tall og spesialtegn»
 * gir «Passord1!» — som er kort, forutsigbart og står i enhver ordliste.
 * Tolv tegn fritt valgt er tryggere, og lettere å huske.
 */
export function vurderPassord(passord: string): string | null {
  const p = passord.normalize("NFKC");
  if (p.length < MINSTE_LENGDE) {
    return `Passordet må være minst ${MINSTE_LENGDE} tegn.`;
  }
  if (p.length > 200) return "Passordet er for langt.";
  if (p.trim().length === 0) return "Passordet kan ikke være bare mellomrom.";
  if (/^(.)\1+$/.test(p)) return "Passordet kan ikke være samme tegn om igjen.";
  return null;
}
