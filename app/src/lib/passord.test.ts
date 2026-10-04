import { test } from "node:test";
import assert from "node:assert/strict";
import { foreslaPassord, lagHash, sjekkPassord, vurderPassord } from "./passord";

test("riktig passord slipper gjennom, feil gjør det ikke", async () => {
  const hash = await lagHash("riktig-passord-123");
  assert.equal(await sjekkPassord("riktig-passord-123", hash), true);
  assert.equal(await sjekkPassord("riktig-passord-124", hash), false);
  assert.equal(await sjekkPassord("", hash), false);
});

test("passordet står aldri i det som lagres", async () => {
  const hash = await lagHash("hemmelig-setning-42");
  assert.ok(!hash.includes("hemmelig"));
  assert.ok(hash.startsWith("scrypt$"));
});

test("samme passord gir ulik hash for to brukere", async () => {
  // Saltet. Uten det ville like passord gitt like rader, og én knekt
  // hash ville avslørt alle som hadde valgt det samme.
  const [a, b] = await Promise.all([lagHash("samme-passord-00"), lagHash("samme-passord-00")]);
  assert.notEqual(a, b);
  assert.equal(await sjekkPassord("samme-passord-00", a), true);
  assert.equal(await sjekkPassord("samme-passord-00", b), true);
});

test("en bruker uten passord kan ikke logge inn med passord", async () => {
  assert.equal(await sjekkPassord("hva som helst", null), false);
  assert.equal(await sjekkPassord("hva som helst", ""), false);
});

test("ødelagte rader gir nei, ikke krasj", async () => {
  for (const rad of [
    "tull",
    "scrypt$16384$8$1$bare-fire-deler",
    "bcrypt$16384$8$1$c2FsdA==$aGFzaA==",
    "scrypt$abc$8$1$c2FsdA==$aGFzaA==",
    "scrypt$16384$8$1$$aGFzaA==",
    "scrypt$16384$8$1$c2FsdA==$",
  ]) {
    assert.equal(await sjekkPassord("passord", rad), false, rad);
  }
});

test("et absurd N i en manipulert rad avvises før den kjøres", async () => {
  // Uten grensen kunne én rad i basen låst serveren i minutter.
  assert.equal(await sjekkPassord("passord", "scrypt$99999999$8$1$c2FsdA==$aGFzaA=="), false);
});

test("æøå og andre skrivemåter gir samme svar", async () => {
  // NFKC: «å» kan skrives som ett tegn eller som a + ring. Tastaturet på
  // en Mac og et på en PC gir ikke nødvendigvis det samme.
  const hash = await lagHash("blåbærsyltetøy");
  assert.equal(await sjekkPassord("bläbärsyltetøy".normalize("NFC"), hash), false);
  assert.equal(await sjekkPassord("blåbærsyltetøy".normalize("NFD"), hash), true);
});

test("foreslått passord er lesbart og uten tegn som forveksles", () => {
  for (let i = 0; i < 40; i++) {
    const p = foreslaPassord();
    assert.match(p, /^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
    assert.ok(!/[O0Il1]/.test(p), p);
  }
});

test("to foreslåtte passord er ikke like", () => {
  const sett = new Set(Array.from({ length: 50 }, () => foreslaPassord()));
  assert.equal(sett.size, 50);
});

test("for korte passord avvises, lange nok godtas", () => {
  assert.ok(vurderPassord("kort") !== null);
  assert.ok(vurderPassord("123456789") !== null);
  assert.equal(vurderPassord("et-godt-passord"), null);
});

test("et passord som er samme tegn om igjen avvises", () => {
  assert.ok(vurderPassord("aaaaaaaaaaaa") !== null);
  assert.ok(vurderPassord("            ") !== null);
});
