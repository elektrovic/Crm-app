import { strict as assert } from "node:assert";
import { test } from "node:test";
import { lagFilnavn, underprosjektNavn, underprosjektNummer } from "./tillegg";

test("underprosjektet er alltid merket Tillegg, med adressen", () => {
  assert.equal(
    underprosjektNavn("1042", "Nybygg Vollebekk", "Bekkeveien 4, 0596 Oslo"),
    "Tillegg – 1042 Bekkeveien 4, 0596 Oslo",
  );
});

test("uten adresse brukes prosjektnavnet i stedet", () => {
  assert.equal(
    underprosjektNavn("1042", "Nybygg Vollebekk", null),
    "Tillegg – 1042 Nybygg Vollebekk",
  );
  // Blank adresse teller som ingen adresse.
  assert.equal(
    underprosjektNavn("1042", "Nybygg Vollebekk", "   "),
    "Tillegg – 1042 Nybygg Vollebekk",
  );
});

test("nummeret henger sammen med hovedprosjektet", () => {
  assert.equal(underprosjektNummer("1042"), "1042-T");
  assert.equal(underprosjektNummer("0993"), "0993-T");
});

const NAAR = new Date("2026-09-06T14:32:00Z");

test("filnavnet sorterer kronologisk og sier hva bildet viser", () => {
  assert.equal(
    lagFilnavn("bilde", "Ekstra stikkontakt, dobbel", "image/jpeg", NAAR),
    "2026-09-06-bilde-ekstra-stikkontakt-dobbel.jpg",
  );
  assert.equal(
    lagFilnavn("signatur", "Ekstra stikkontakt, dobbel", "image/png", NAAR),
    "2026-09-06-signatur-ekstra-stikkontakt-dobbel.png",
  );
});

test("norske tegn blir til noe et filsystem takler", () => {
  assert.equal(
    lagFilnavn("bilde", "Kabelgjennomføring brannklasse", "image/jpeg", NAAR),
    "2026-09-06-bilde-kabelgjennomforing-brannklasse.jpg",
  );
  assert.equal(
    lagFilnavn("bilde", "Bytte knekt takstein på tak", "image/jpeg", NAAR),
    "2026-09-06-bilde-bytte-knekt-takstein-pa-tak.jpg",
  );
});

test("lange og tomme beskrivelser gir fortsatt et brukbart navn", () => {
  const langt = lagFilnavn("bilde", "a".repeat(120), "image/jpeg", NAAR);
  assert.equal(langt.length < 70, true, `for langt: ${langt}`);

  assert.equal(
    lagFilnavn("bilde", "!!! ???", "image/jpeg", NAAR),
    "2026-09-06-bilde-tillegg.jpg",
  );
});
