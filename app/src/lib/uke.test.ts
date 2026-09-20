import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mandagen, ukedager } from "./uke";

test("mandagen finner riktig ukestart uansett hvilken dag man spør fra", () => {
  // 2026-09-05 er en lørdag; uka startet mandag 31. august.
  assert.equal(mandagen("2026-09-05"), "2026-08-31");
  assert.equal(mandagen("2026-08-31"), "2026-08-31");
  // Søndag hører til uka som gikk, ikke den som kommer.
  assert.equal(mandagen("2026-09-06"), "2026-08-31");
  assert.equal(mandagen("2026-09-07"), "2026-09-07");
});

test("mandagen krysser månedsskifte og årsskifte", () => {
  assert.equal(mandagen("2026-03-01"), "2026-02-23");
  // 1. januar 2027 er en fredag.
  assert.equal(mandagen("2027-01-01"), "2026-12-28");
});

test("ukedager gir fem virkedager fra mandag", () => {
  const dager = ukedager("2026-08-31");

  assert.equal(dager.length, 5);
  assert.deepEqual(
    dager.map((d) => d.iso),
    ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"],
  );
});

test("ukedager bommer ikke på uka der klokka stilles", () => {
  // Klokka stilles natt til søndag 25. oktober 2026. Regner vi i lokal tid
  // blir ett døgn 25 timer, og den siste dagen kan falle på feil dato.
  const dager = ukedager("2026-10-19");

  assert.deepEqual(
    dager.map((d) => d.iso),
    ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"],
  );

  // Og samme sjekk om våren, der et døgn er 23 timer.
  const vaar = ukedager("2026-03-30");
  assert.deepEqual(
    vaar.map((d) => d.iso),
    ["2026-03-30", "2026-03-31", "2026-04-01", "2026-04-02", "2026-04-03"],
  );
});

test("ukedagene har lesbare norske navn", () => {
  const dager = ukedager("2026-08-31");
  assert.match(dager[0]!.navn.toLowerCase(), /^man/);
  assert.match(dager[4]!.navn.toLowerCase(), /^fre/);
});
