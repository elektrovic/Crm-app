import { strict as assert } from "node:assert";
import { test } from "node:test";
import { kjennetegn, velgKundeFraTekst } from "./kundetreff";

const SELVAAG = { id: "selvaag", navn: "Selvaag Bolig AS" };
const SAMEIET = { id: "sameiet", navn: "Sameiet Ullevålsveien 71" };
const OBOS = { id: "obos", navn: "Sameiet Suhms Gate 12" };

test("navnet i tittelen kobler", () => {
  assert.equal(
    velgKundeFraTekst("Befaring hos Selvaag om tavle", [SELVAAG, SAMEIET]),
    "selvaag",
  );
});

test("intetsigende ord kobler ikke", () => {
  // «Sameiet» alene skiller ikke de to sameiene fra hverandre.
  assert.equal(velgKundeFraTekst("Ringte sameiet i dag", [SAMEIET, OBOS]), null);
  // Og «AS» treffer halve kunderegisteret.
  assert.equal(velgKundeFraTekst("Snakket med AS", [SELVAAG]), null);
});

test("to treff kobler ingenting", () => {
  const tekst = "Møte om Ullevålsveien og Suhms gate";
  assert.equal(velgKundeFraTekst(tekst, [SAMEIET, OBOS]), null);
});

test("ingen treff gir null", () => {
  assert.equal(velgKundeFraTekst("Internt møte om ferieavvikling", [SELVAAG]), null);
  assert.equal(velgKundeFraTekst(null, [SELVAAG]), null);
  assert.equal(velgKundeFraTekst("", [SELVAAG]), null);
});

test("store og små bokstaver spiller ingen rolle", () => {
  assert.equal(velgKundeFraTekst("SELVAAG ringte", [SELVAAG]), "selvaag");
  assert.equal(velgKundeFraTekst("selvaag ringte", [SELVAAG]), "selvaag");
});

test("kjennetegn fjerner selskapsformer og korte ord", () => {
  assert.deepEqual(kjennetegn("Selvaag Bolig AS"), ["selvaag"]);
  assert.deepEqual(kjennetegn("Sameiet Ullevålsveien 71"), ["ullevålsveien"]);
  assert.deepEqual(kjennetegn("AS"), []);
});

test("en kunde uten brukbare kjennetegn kobler aldri", () => {
  // Ellers ville en kunde som bare heter «AS» koblet til alt.
  assert.equal(velgKundeFraTekst("hva som helst", [{ id: "x", navn: "AS" }]), null);
});
