import { strict as assert } from "node:assert";
import { test } from "node:test";
import { velgKunde } from "./kundetreff";

const SAMEIE = { id: "sameie", telefon: "922 41 088" };
const ENTREPRENOR = { id: "entreprenor", telefon: "922 41 088" };
const ANNEN = { id: "annen", telefon: "480 12 345" };
const UTEN = { id: "uten", telefon: null };

test("ett treff kobles", () => {
  assert.equal(velgKunde("480 12 345", [SAMEIE, ANNEN, UTEN]), "annen");
});

test("samme nummer skrevet annerledes treffer likevel", () => {
  for (const skrivemate of ["+47 480 12 345", "48012345", "0047 480 12 345", " 480 12 345 "]) {
    assert.equal(velgKunde(skrivemate, [ANNEN]), "annen", `bommet på ${skrivemate}`);
  }
});

test("to kunder på samme nummer kobler ingenting", () => {
  // Dette er ikke en kantsituasjon: et sameie og entreprenøren deler
  // styrelederens mobil. Feil kunde er verre enn ingen kunde, fordi den
  // feilen ikke synes.
  assert.equal(velgKunde("922 41 088", [SAMEIE, ENTREPRENOR, ANNEN]), null);
});

test("ukjent nummer kobler ingenting", () => {
  assert.equal(velgKunde("911 11 111", [SAMEIE, ANNEN]), null);
});

test("tomt eller manglende nummer kobler ingenting", () => {
  assert.equal(velgKunde(null, [ANNEN]), null);
  assert.equal(velgKunde("", [ANNEN]), null);
  assert.equal(velgKunde("   ", [ANNEN]), null);
});

test("kunder uten nummer forstyrrer ikke", () => {
  assert.equal(velgKunde("480 12 345", [UTEN, ANNEN, UTEN]), "annen");
});
