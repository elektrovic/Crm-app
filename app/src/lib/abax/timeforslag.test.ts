/**
 * Tester for timeforslag fra kjørebok.
 * Kjøres med: node --test --experimental-strip-types "src/**\/*.test.ts"
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { AbaxTur } from "./typer";
import { finnStopp, lagTimeforslag, sumTimer, type ProsjektPunkt } from "./timeforslag";

/** Bekkeveien 4, 0596 Oslo — prosjekt 1042 i prototypen. */
const BEKKEVEIEN: ProsjektPunkt = {
  id: "p-1042",
  nummer: "1042",
  navn: "Nybygg Vollebekk",
  lat: 59.9432,
  lon: 10.8321,
};

/** Storgata 22 — prosjekt 1027, drøyt tre kilometer unna. */
const STORGATA: ProsjektPunkt = {
  id: "p-1027",
  nummer: "1027",
  navn: "Serviceoppdrag Storgata 22",
  lat: 59.9155,
  lon: 10.7562,
};

function tur(
  fraTid: string,
  tilTid: string,
  slutt: { lat: number; lon: number },
  start = slutt,
): AbaxTur {
  return {
    id: `${fraTid}-${tilTid}`,
    from: { timestamp: fraTid, latitude: start.lat, longitude: start.lon },
    to: { timestamp: tilTid, latitude: slutt.lat, longitude: slutt.lon },
  };
}

test("bilen som står på Bekkeveien 07:34–12:10 gir 4,5 t på prosjekt 1042", () => {
  const turer: AbaxTur[] = [
    // Kjørte fra base og parkerte på Bekkeveien 07:34.
    tur("2026-09-02T06:50:00Z", "2026-09-02T07:34:00Z", BEKKEVEIEN),
    // Kjørte videre 12:10.
    tur("2026-09-02T12:10:00Z", "2026-09-02T12:35:00Z", STORGATA, BEKKEVEIEN),
  ];

  const forslag = lagTimeforslag(turer, [BEKKEVEIEN, STORGATA]);

  assert.equal(forslag.length, 1);
  assert.equal(forslag[0]!.prosjektNummer, "1042");
  // 4 t 36 min avrundet til nærmeste kvarter.
  assert.equal(forslag[0]!.timer, 4.5);
});

test("stopp som er for korte regnes ikke som arbeid", () => {
  const turer: AbaxTur[] = [
    tur("2026-09-02T08:00:00Z", "2026-09-02T08:20:00Z", BEKKEVEIEN),
    // Bare 10 minutters stopp — under grensen på 20.
    tur("2026-09-02T08:30:00Z", "2026-09-02T08:50:00Z", STORGATA, BEKKEVEIEN),
  ];

  assert.equal(lagTimeforslag(turer, [BEKKEVEIEN, STORGATA]).length, 0);
});

test("stopp langt fra ethvert prosjekt gir ingen forslag", () => {
  const langtUnna = { lat: 60.5, lon: 11.5 };
  const turer: AbaxTur[] = [
    tur("2026-09-02T08:00:00Z", "2026-09-02T08:30:00Z", langtUnna),
    tur("2026-09-02T12:00:00Z", "2026-09-02T12:30:00Z", STORGATA, langtUnna),
  ];

  assert.equal(lagTimeforslag(turer, [BEKKEVEIEN, STORGATA]).length, 0);
});

test("flere stopp på samme prosjekt slås sammen til én linje", () => {
  const turer: AbaxTur[] = [
    tur("2026-09-02T06:50:00Z", "2026-09-02T07:00:00Z", BEKKEVEIEN),
    // To timer på Bekkeveien, så en tur ut og tilbake.
    tur("2026-09-02T09:00:00Z", "2026-09-02T09:30:00Z", STORGATA, BEKKEVEIEN),
    tur("2026-09-02T10:30:00Z", "2026-09-02T11:00:00Z", BEKKEVEIEN, STORGATA),
    tur("2026-09-02T13:00:00Z", "2026-09-02T13:30:00Z", STORGATA, BEKKEVEIEN),
  ];

  const forslag = lagTimeforslag(turer, [BEKKEVEIEN, STORGATA]);
  const bekkeveien = forslag.find((f) => f.prosjektNummer === "1042");

  assert.ok(bekkeveien, "forventet ett samlet forslag for Bekkeveien");
  // 07:00–09:00 (2 t) + 11:00–13:00 (2 t)
  assert.equal(bekkeveien.timer, 4);
  // Spennet dekker hele dagen på prosjektet, ikke bare siste stopp.
  assert.equal(bekkeveien.fra.toISOString(), "2026-09-02T07:00:00.000Z");
  assert.equal(bekkeveien.til.toISOString(), "2026-09-02T13:00:00.000Z");
});

test("turer som kommer i tilfeldig rekkefølge sorteres før beregning", () => {
  const iRekkefolge: AbaxTur[] = [
    tur("2026-09-02T06:50:00Z", "2026-09-02T07:34:00Z", BEKKEVEIEN),
    tur("2026-09-02T12:10:00Z", "2026-09-02T12:35:00Z", STORGATA, BEKKEVEIEN),
  ];
  const stokket = [iRekkefolge[1]!, iRekkefolge[0]!];

  assert.deepEqual(
    lagTimeforslag(stokket, [BEKKEVEIEN, STORGATA]),
    lagTimeforslag(iRekkefolge, [BEKKEVEIEN, STORGATA]),
  );
});

test("overlappende turer i datagrunnlaget gir ikke negative timer", () => {
  const turer: AbaxTur[] = [
    tur("2026-09-02T08:00:00Z", "2026-09-02T09:00:00Z", BEKKEVEIEN),
    // Starter før forrige tur var ferdig — skal hoppes over, ikke telles.
    tur("2026-09-02T08:30:00Z", "2026-09-02T09:30:00Z", STORGATA, BEKKEVEIEN),
  ];

  assert.equal(lagTimeforslag(turer, [BEKKEVEIEN, STORGATA]).length, 0);
});

test("turer uten sluttposisjon hoppes over uten å krasje", () => {
  const turer: AbaxTur[] = [
    { id: "a", from: { timestamp: "2026-09-02T08:00:00Z" }, to: { timestamp: "2026-09-02T08:30:00Z" } },
    tur("2026-09-02T12:00:00Z", "2026-09-02T12:30:00Z", STORGATA),
  ];

  assert.equal(finnStopp(turer, 20).length, 0);
});

test("sumTimer legger sammen alle forslagene", () => {
  const turer: AbaxTur[] = [
    tur("2026-09-02T06:50:00Z", "2026-09-02T07:00:00Z", BEKKEVEIEN),
    tur("2026-09-02T11:00:00Z", "2026-09-02T11:20:00Z", STORGATA, BEKKEVEIEN),
    tur("2026-09-02T15:00:00Z", "2026-09-02T15:30:00Z", BEKKEVEIEN, STORGATA),
  ];

  const forslag = lagTimeforslag(turer, [BEKKEVEIEN, STORGATA]);
  // 4 t på Bekkeveien + 3 t 40 min på Storgata, avrundet til kvarter.
  assert.equal(sumTimer(forslag), 7.75);
});
