import { strict as assert } from "node:assert";
import { test } from "node:test";
import { normaliserEllerNull, normaliserNummer, tilVisning, UgyldigNummerFeil } from "./telefon";
import { lagMelding, malMelding } from "./meldinger";

test("norske numre normaliseres uansett hvordan de er skrevet", () => {
  // Alle variantene som faktisk dukker opp i Tripletex og i felt fylt ut for hånd.
  for (const variant of [
    "92241088",
    "922 41 088",
    "+4792241088",
    "+47 922 41 088",
    "004792241088",
    "(+47) 92-24-10-88",
  ]) {
    assert.equal(normaliserNummer(variant), "+4792241088", `feilet på «${variant}»`);
  }
});

test("fasttelefon og for korte numre avvises", () => {
  // Norske mobilnumre starter på 4 eller 9 — 22-nummer er fasttelefon.
  assert.throws(() => normaliserNummer("22334455"), UgyldigNummerFeil);
  assert.throws(() => normaliserNummer("1234"), UgyldigNummerFeil);
  assert.throws(() => normaliserNummer(""), UgyldigNummerFeil);
  assert.throws(() => normaliserNummer("ikke et nummer"), UgyldigNummerFeil);
});

test("normaliserEllerNull svelger feil i stedet for å kaste", () => {
  assert.equal(normaliserEllerNull("922 41 088"), "+4792241088");
  assert.equal(normaliserEllerNull("22334455"), null);
  assert.equal(normaliserEllerNull(null), null);
  assert.equal(normaliserEllerNull(undefined), null);
});

test("nummer vises i norsk format", () => {
  assert.equal(tilVisning("+4792241088"), "922 41 088");
  // Utenlandske numre vises som de er.
  assert.equal(tilVisning("+46701234567"), "+46701234567");
});

test("melding før oppdrag nevner montør, firma og tidsvindu", () => {
  const m = lagMelding("for_oppdrag", {
    kundenavn: "Bjørn Sæther",
    prosjektnummer: "1042",
    montornavn: "Tore Eriksen",
    firmanavn: "Halland Gruppen",
    tidsvindu: "08:00–12:00",
    kontakttelefon: "922 41 088",
  });

  assert.match(m, /Hei Bjørn!/);
  assert.match(m, /Tore fra Halland Gruppen/);
  // Tidsvinduet kommer inn med tankestrek og skal ut med bindestrek.
  assert.match(m, /08:00-12:00/);
  assert.match(m, /922 41 088/);
});

test("melding etter oppdrag viser til prosjektnummeret", () => {
  const m = lagMelding("etter_oppdrag", {
    kundenavn: null,
    prosjektnummer: "1042",
    montornavn: "Tore Eriksen",
    firmanavn: "Halland Gruppen",
  });

  assert.match(m, /^Hei! /);
  assert.match(m, /utført av Tore/);
  assert.match(m, /oppdrag 1042/);
  // Uten kontakttelefon skal det ikke stå en tom «Ring .»
  assert.doesNotMatch(m, /Ring \./);
});

test("meldingene holder seg innenfor én SMS", () => {
  const forOppdrag = lagMelding("for_oppdrag", {
    kundenavn: "Bjørn Sæther",
    prosjektnummer: "1042",
    montornavn: "Tore Eriksen",
    firmanavn: "Halland Gruppen",
    tidsvindu: "08:00–12:00",
    kontakttelefon: "922 41 088",
  });

  const maalt = malMelding(forOppdrag);
  // Tankestreken i tidsvinduet skal være byttet til bindestrek. Ett eneste
  // tegn utenfor GSM-alfabetet ville halvert grensen og doblet prisen.
  assert.equal(maalt.krevetUnicode, false, `tvang unicode: ${forOppdrag}`);
  assert.equal(maalt.antallSms, 1, `ble ${maalt.tegn} tegn: ${forOppdrag}`);
  assert.match(forOppdrag, /08:00-12:00/);
});

test("æøå koster ett tegn, emoji tvinger meldingen til unicode", () => {
  assert.equal(malMelding("Blåbærsyltetøy").krevetUnicode, false);

  const medEmoji = malMelding("Takk for oppdraget 👍");
  assert.equal(medEmoji.krevetUnicode, true);
  // Unicode halverer grensen fra 160 til 70 tegn.
  assert.equal(medEmoji.antallSms, 1);
});

test("lang melding deles i flere SMS", () => {
  assert.equal(malMelding("a".repeat(160)).antallSms, 1);
  assert.equal(malMelding("a".repeat(161)).antallSms, 2);
  assert.equal(malMelding("").antallSms, 0);
});
