import { test } from "node:test";
import assert from "node:assert/strict";
import { tellBrukere, type Brukerrad } from "./brukere";

function rad(over: Partial<Brukerrad> = {}): Brukerrad {
  return {
    id: crypto.randomUUID(),
    navn: "Navn Navnesen",
    epost: "navn@firma.no",
    rolle: "montor",
    avdeling: "Elektro",
    initialer: "NN",
    farge: "#2563EB",
    aktiv: true,
    sisteInnlogging: new Date(),
    maaByttePassord: false,
    harPassord: true,
    erMeg: false,
    ...over,
  };
}

test("teller aktive og sperrede hver for seg", () => {
  const t = tellBrukere([rad(), rad(), rad({ aktiv: false })]);
  assert.equal(t.aktive, 2);
  assert.equal(t.sperrede, 1);
});

test("en sperret administrator teller ikke som administrator", () => {
  // Ellers ser det ut som noen har tilgang, og den som sperret henne tror
  // systemet fortsatt har to som kan slippe folk inn.
  const t = tellBrukere([rad({ rolle: "admin" }), rad({ rolle: "admin", aktiv: false })]);
  assert.equal(t.administratorer, 1);
});

test("de som aldri har logget inn plukkes ut", () => {
  const t = tellBrukere([rad({ sisteInnlogging: null }), rad(), rad({ sisteInnlogging: null })]);
  assert.equal(t.aldriInne, 2);
});

test("en sperret bruker som aldri logget inn trenger ingen oppfølging", () => {
  const t = tellBrukere([rad({ sisteInnlogging: null, aktiv: false })]);
  assert.equal(t.aldriInne, 0);
});

test("de som fortsatt går med midlertidig passord telles", () => {
  const t = tellBrukere([rad({ maaByttePassord: true }), rad()]);
  assert.equal(t.medMidlertidig, 1);
});

test("tom liste gir nuller, ikke feil", () => {
  assert.deepEqual(tellBrukere([]), {
    aktive: 0,
    sperrede: 0,
    administratorer: 0,
    aldriInne: 0,
    medMidlertidig: 0,
  });
});
