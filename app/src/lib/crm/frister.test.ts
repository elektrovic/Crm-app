import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  dagerTil,
  fristTekst,
  klassifiserFrist,
  sorterOppfolginger,
  tellFrister,
  type Oppfolgingsrad,
} from "./frister";

const IDAG = "2026-09-05";

function rad(over: Partial<Oppfolgingsrad> & { id: string; frist: string }): Oppfolgingsrad {
  return {
    hva: "Ring kunde",
    ansvarligNavn: "Marius Kvam",
    kundeNavn: "Sameiet Ullevålsveien 71",
    fullfort: false,
    ...over,
  };
}

test("dagerTil regner hele dager i begge retninger", () => {
  assert.equal(dagerTil("2026-09-05", IDAG), 0);
  assert.equal(dagerTil("2026-09-06", IDAG), 1);
  assert.equal(dagerTil("2026-09-01", IDAG), -4);
  // Over et månedsskifte.
  assert.equal(dagerTil("2026-10-01", IDAG), 26);
});

test("dagerTil krysser sommertidsskiftet uten å bomme", () => {
  // Norge stiller klokka natt til 25. oktober 2026. Regner vi i lokal tid
  // blir ett av døgnene 23 eller 25 timer, og differansen bommer med én dag.
  assert.equal(dagerTil("2026-10-26", "2026-10-24"), 2);
  assert.equal(dagerTil("2026-03-30", "2026-03-28"), 2);
});

test("ugyldig dato kaster i stedet for å gi et tall", () => {
  assert.throws(() => dagerTil("ikke en dato", IDAG), RangeError);
});

test("frister klassifiseres etter hvor nær de er", () => {
  assert.equal(klassifiserFrist("2026-09-01", IDAG), "over_frist");
  assert.equal(klassifiserFrist("2026-09-05", IDAG), "i_dag");
  assert.equal(klassifiserFrist("2026-09-08", IDAG), "snart");
  assert.equal(klassifiserFrist("2026-09-12", IDAG), "snart");
  assert.equal(klassifiserFrist("2026-09-13", IDAG), "senere");
});

test("fristteksten er noe et menneske kan lese", () => {
  assert.equal(fristTekst("2026-09-05", IDAG), "I dag");
  assert.equal(fristTekst("2026-09-06", IDAG), "I morgen");
  assert.equal(fristTekst("2026-09-04", IDAG), "1 dag på overtid");
  assert.equal(fristTekst("2026-09-01", IDAG), "4 dager på overtid");
  assert.equal(fristTekst("2026-09-10", IDAG), "Om 5 dager");
});

test("over frist havner øverst, deretter i dag, så framover", () => {
  const sortert = sorterOppfolginger(
    [
      rad({ id: "senere", frist: "2026-09-20" }),
      rad({ id: "idag", frist: "2026-09-05" }),
      rad({ id: "overfrist", frist: "2026-08-28" }),
      rad({ id: "snart", frist: "2026-09-07" }),
    ],
    IDAG,
  );

  assert.deepEqual(
    sortert.map((r) => r.id),
    ["overfrist", "idag", "snart", "senere"],
  );
  assert.equal(sortert[0]!.klasse, "over_frist");
});

test("ufordelte saker kommer først innenfor samme dato", () => {
  const sortert = sorterOppfolginger(
    [
      rad({ id: "tildelt", frist: "2026-09-05", ansvarligNavn: "Marius Kvam" }),
      rad({ id: "ufordelt", frist: "2026-09-05", ansvarligNavn: null }),
    ],
    IDAG,
  );

  assert.deepEqual(
    sortert.map((r) => r.id),
    ["ufordelt", "tildelt"],
  );
  assert.equal(sortert[0]!.ufordelt, true);
});

test("fullførte oppfølginger faller ut av lista", () => {
  const sortert = sorterOppfolginger(
    [
      rad({ id: "ferdig", frist: "2026-08-01", fullfort: true }),
      rad({ id: "åpen", frist: "2026-09-05" }),
    ],
    IDAG,
  );

  assert.deepEqual(
    sortert.map((r) => r.id),
    ["åpen"],
  );
});

test("tellingen i toppen stemmer med lista", () => {
  const sortert = sorterOppfolginger(
    [
      rad({ id: "a", frist: "2026-08-28" }),
      rad({ id: "b", frist: "2026-09-02", ansvarligNavn: null }),
      rad({ id: "c", frist: "2026-09-05" }),
      rad({ id: "d", frist: "2026-09-30" }),
      rad({ id: "e", frist: "2026-08-01", fullfort: true }),
    ],
    IDAG,
  );

  // a og b er over frist, c er i dag, b er ufordelt. e teller ikke.
  assert.deepEqual(tellFrister(sortert), { overFrist: 2, iDag: 1, ufordelt: 1 });
});
