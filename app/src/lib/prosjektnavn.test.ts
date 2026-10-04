import { strict as assert } from "node:assert";
import { test } from "node:test";
import { utenNummer } from "./prosjektnavn";

test("nummeret foran navnet klippes bort", () => {
  assert.equal(utenNummer("20006", "20006 Gregor Grams vei 3"), "Gregor Grams vei 3");
  assert.equal(utenNummer("20543", "20543 Solheimsgata 1B - Totalrenovering"),
    "Solheimsgata 1B - Totalrenovering");
});

test("tankestrek og kolon som skille regnes også", () => {
  assert.equal(utenNummer("1042", "1042 – Vollebekk"), "Vollebekk");
  assert.equal(utenNummer("1042", "1042: Vollebekk"), "Vollebekk");
  assert.equal(utenNummer("1042", "1042 - Vollebekk"), "Vollebekk");
});

test("navn uten nummer foran står urørt", () => {
  assert.equal(utenNummer("1042", "Nybygg Vollebekk"), "Nybygg Vollebekk");
});

test("et lengre nummer som begynner likt klippes ikke", () => {
  // «20061» er ikke starten på «200610» i betydningen «nummer + navn».
  assert.equal(utenNummer("20061", "200610 Noe annet"), "200610 Noe annet");
});

test("er nummeret hele navnet, beholdes det", () => {
  assert.equal(utenNummer("20278", "20278"), "20278");
  assert.equal(utenNummer("20278", "20278 "), "20278");
});

test("tomt nummer gjør ingen skade", () => {
  assert.equal(utenNummer("", "  Vollebekk  "), "Vollebekk");
});
