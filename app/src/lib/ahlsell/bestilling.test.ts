import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  emne,
  finnMangler,
  linjerUtenVarenummer,
  nesteBestillingsnummer,
  tilCsv,
  tilTekst,
  type Bestillingsdokument,
} from "./bestilling";

function dok(over: Partial<Bestillingsdokument> = {}): Bestillingsdokument {
  return {
    bestillingsnummer: "B-2026-0042",
    kundenummer: "112233",
    prosjektnummer: "1042",
    prosjektnavn: "Nybygg Vollebekk",
    leveringsadresse: "Bekkeveien 4, 0596 Oslo",
    onsketLeveringsdato: "2026-09-10",
    bestiltAv: "Tore Eriksen",
    linjer: [
      {
        linjenummer: 1,
        beskrivelse: "Downlight 8W dimbar",
        efoNummer: "1451234",
        antall: 14,
        enhet: "STK",
      },
      {
        linjenummer: 2,
        beskrivelse: "Kabel PFSP 3G1,5",
        grossistVarenummer: "AH-99871",
        antall: 100,
        enhet: "M",
      },
    ],
    ...over,
  };
}

test("et komplett dokument har ingen mangler", () => {
  assert.deepEqual(finnMangler(dok()), []);
});

test("tomme og ugyldige linjer fanges før sending", () => {
  assert.match(finnMangler(dok({ linjer: [] }))[0]!, /ingen linjer/i);

  const feil = finnMangler(
    dok({
      linjer: [{ linjenummer: 1, beskrivelse: "  ", antall: 0, enhet: "STK" }],
    }),
  );
  assert.equal(feil.length, 2);
  assert.match(feil.join(" "), /antall 0/);
  assert.match(feil.join(" "), /mangler beskrivelse/);
});

test("linjer uten varenummer plukkes ut, men stopper ikke bestillingen", () => {
  const d = dok({
    linjer: [
      ...dok().linjer,
      { linjenummer: 3, beskrivelse: "Litt av hvert", antall: 1, enhet: "STK" },
    ],
  });

  assert.deepEqual(finnMangler(d), []);
  const uten = linjerUtenVarenummer(d);
  assert.equal(uten.length, 1);
  assert.equal(uten[0]!.linjenummer, 3);
});

test("CSV har én rad per vare og bærer prosjektnummeret på hver", () => {
  const rader = tilCsv(dok()).trim().split("\r\n");

  assert.equal(rader.length, 3); // hode + to varelinjer
  assert.match(rader[0]!, /^Bestillingsnummer;Kundenummer;Prosjektnummer/);
  assert.match(rader[1]!, /^B-2026-0042;112233;1042;1;1451234;;Downlight 8W dimbar;14;STK/);
  assert.match(rader[2]!, /;100;M;/);
});

test("CSV siterer felter som inneholder skilletegn eller anførselstegn", () => {
  const csv = tilCsv(
    dok({
      linjer: [
        {
          linjenummer: 1,
          beskrivelse: 'Kabel 3x1,5; type "PFSP"',
          antall: 1,
          enhet: "M",
        },
      ],
    }),
  );

  // Semikolonet i beskrivelsen skal ikke lage en ny kolonne.
  assert.match(csv, /"Kabel 3x1,5; type ""PFSP"""/);
  const datarad = csv.trim().split("\r\n")[1]!;
  assert.equal(datarad.split(";").length > 11, true, "sitering skal beholde feltene samlet");
});

test("desimaler skrives med punktum, heltall uten", () => {
  const csv = tilCsv(
    dok({
      linjer: [
        { linjenummer: 1, beskrivelse: "Kabel", antall: 12.5, enhet: "M" },
        { linjenummer: 2, beskrivelse: "Downlight", antall: 3, enhet: "STK" },
      ],
    }),
  );

  assert.match(csv, /;12\.50;M;/);
  assert.match(csv, /;3;STK;/);
});

test("tekstversjonen er lesbar og merker linjer uten varenummer", () => {
  const tekst = tilTekst(
    dok({
      linjer: [
        ...dok().linjer,
        { linjenummer: 3, beskrivelse: "Noe rart", antall: 2, enhet: "STK" },
      ],
      merknad: "Leveres til brakkeriggen",
    }),
  );

  assert.match(tekst, /Bestilling B-2026-0042/);
  assert.match(tekst, /Prosjekt 1042 - Nybygg Vollebekk/);
  assert.match(tekst, /EFO 1451234/);
  assert.match(tekst, /Varenr AH-99871/);
  assert.match(tekst, /uten varenummer/);
  assert.match(tekst, /Merknad: Leveres til brakkeriggen/);
  assert.match(tekst, /Merk leveransen med prosjekt 1042/);
});

test("emnet sier hva bestillingen gjelder", () => {
  assert.equal(emne(dok()), "Bestilling B-2026-0042 - prosjekt 1042 - 2 varer");
  assert.match(emne(dok({ linjer: [dok().linjer[0]!] })), /1 vare$/);
});

test("bestillingsnummer teller opp med fast bredde", () => {
  assert.equal(nesteBestillingsnummer(2026, 0), "B-2026-0001");
  assert.equal(nesteBestillingsnummer(2026, 41), "B-2026-0042");
  assert.equal(nesteBestillingsnummer(2026, 9999), "B-2026-10000");
});
