/**
 * Tester for krypteringen.
 *
 * Nøkkelen settes i testen selv, så disse kan kjøres uten et .env-oppsett.
 */
import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

// Nøkkelen leses først når krypter/dekrypter faktisk kalles, så det holder
// å sette den her — før noen test kjører.
process.env.KRYPTERINGSNOKKEL = randomBytes(32).toString("base64");

import {
  dekrypter,
  krypter,
  KryptoFeil,
  kryptoErSattOpp,
  likeHemmeligheter,
} from "./krypto";

test("en kryptert verdi kan dekrypteres tilbake", () => {
  const token = "tripletex-employee-token-abc123";
  assert.equal(dekrypter(krypter(token)), token);
});

test("norske tegn overlever turen", () => {
  const tekst = "Bjørn Sæther — nøkkelkode 1975*";
  assert.equal(dekrypter(krypter(tekst)), tekst);
});

test("samme klartekst gir forskjellig chiffertekst hver gang", () => {
  // Uten dette ville to like tokens vært synlig like i databasen.
  const a = krypter("samme hemmelighet");
  const b = krypter("samme hemmelighet");
  assert.notEqual(a, b);
  assert.equal(dekrypter(a), dekrypter(b));
});

test("lagret verdi lekker ikke klarteksten", () => {
  const lagret = krypter("hemmelig-token");
  assert.doesNotMatch(lagret, /hemmelig/);
  assert.match(lagret, /^v1\./);
});

test("en endret rad lar seg ikke dekryptere", () => {
  const lagret = krypter("tripletex-token");
  const deler = lagret.split(".");

  // Bytt ett tegn i chifferteksten — GCM skal avvise hele verdien.
  const chiffer = deler[3]!;
  const tuklet = [
    deler[0],
    deler[1],
    deler[2],
    (chiffer[0] === "A" ? "B" : "A") + chiffer.slice(1),
  ].join(".");

  assert.throws(() => dekrypter(tuklet), KryptoFeil);
});

test("feil format avvises med en forklaring, ikke en krasj", () => {
  assert.throws(() => dekrypter("bare tull"), KryptoFeil);
  assert.throws(() => dekrypter("v2.a.b.c"), KryptoFeil);
  assert.throws(() => krypter(""), KryptoFeil);
});

test("en verdi kryptert med en annen nøkkel avvises", () => {
  const lagret = krypter("token");
  const gammelNokkel = process.env.KRYPTERINGSNOKKEL;

  process.env.KRYPTERINGSNOKKEL = randomBytes(32).toString("base64");
  assert.throws(() => dekrypter(lagret), KryptoFeil);

  process.env.KRYPTERINGSNOKKEL = gammelNokkel;
  assert.equal(dekrypter(lagret), "token");
});

test("en nøkkel med feil lengde stoppes med en tydelig beskjed", () => {
  const gammel = process.env.KRYPTERINGSNOKKEL;

  process.env.KRYPTERINGSNOKKEL = Buffer.from("for kort").toString("base64");
  assert.equal(kryptoErSattOpp(), false);
  assert.throws(() => krypter("noe"), /32 byte/);

  process.env.KRYPTERINGSNOKKEL = gammel;
  assert.equal(kryptoErSattOpp(), true);
});

test("likeHemmeligheter sammenligner riktig", () => {
  assert.equal(likeHemmeligheter("abc", "abc"), true);
  assert.equal(likeHemmeligheter("abc", "abd"), false);
  assert.equal(likeHemmeligheter("abc", "abcd"), false);
});
