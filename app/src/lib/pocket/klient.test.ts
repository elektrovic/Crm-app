import { strict as assert } from "node:assert";
import { test } from "node:test";
import { lesInnhold, lesListe, lesOpptak } from "./klient";

test("opptak leses med understrek-navn", () => {
  const o = lesOpptak({
    id: "rec_1",
    title: "Samtale med Bjørn",
    recording_at: "2026-10-04T09:15:00Z",
    duration: 412,
    language: "no",
    recorded_by: { email: "marius@hallandgroup.no", display_name: "Marius" },
  });
  assert.equal(o?.pocketId, "rec_1");
  assert.equal(o?.tittel, "Samtale med Bjørn");
  assert.equal(o?.startet.toISOString(), "2026-10-04T09:15:00.000Z");
  assert.equal(o?.varighetSekunder, 412);
  assert.equal(o?.epost, "marius@hallandgroup.no");
});

test("opptak leses med stor-bokstav-navn", () => {
  // De to beskrivelsene av API-et oppgir feltene i hver sin form. Begge
  // må virke, ellers er det et lotteri hvilken vi traff.
  const o = lesOpptak({
    id: "rec_2",
    recordingAt: "2026-10-03T08:00:00Z",
    durationSeconds: "90",
    recordedBy: { email: "lise@hallandgroup.no" },
  });
  assert.equal(o?.pocketId, "rec_2");
  assert.equal(o?.varighetSekunder, 90);
  assert.equal(o?.epost, "lise@hallandgroup.no");
});

test("opptak uten tidspunkt forkastes", () => {
  // Å sette dagens dato ville gjort raden til en løgn som ser riktig ut.
  assert.equal(lesOpptak({ id: "rec_3", title: "Uten tid" }), null);
  assert.equal(lesOpptak({ id: "rec_4", recording_at: "tull" }), null);
});

test("opptak uten id forkastes", () => {
  assert.equal(lesOpptak({ recording_at: "2026-10-04T09:00:00Z" }), null);
});

test("sammendrag og oppgaver plukkes ut", () => {
  const i = lesInnhold({
    summarizations: [
      {
        content: "Kunden vil ha tilbud på tak.",
        action_items: [{ text: "Send tilbud" }, "Ring tilbake fredag"],
      },
    ],
  });
  assert.equal(i.sammendrag, "Kunden vil ha tilbud på tak.");
  assert.deepEqual(i.oppgaver, ["Send tilbud", "Ring tilbake fredag"]);
});

test("sammendrag satt sammen av seksjoner", () => {
  const i = lesInnhold({
    summary: { sections: [{ heading: "Avtalt", content: "Befaring tirsdag" }] },
  });
  assert.equal(i.sammendrag, "Avtalt: Befaring tirsdag");
});

test("samme oppgave to ganger blir én", () => {
  const i = lesInnhold({
    summarizations: [
      { content: "A", actionItems: ["Ring Bjørn"] },
      { content: "B", action_items: ["Ring Bjørn"] },
    ],
  });
  assert.deepEqual(i.oppgaver, ["Ring Bjørn"]);
  assert.equal(i.sammendrag, "A", "første sammendrag beholdes");
});

test("tomt eller ukjent innhold gir tomt, ikke krasj", () => {
  assert.deepEqual(lesInnhold({}), { sammendrag: null, oppgaver: [] });
  assert.deepEqual(lesInnhold(null), { sammendrag: null, oppgaver: [] });
  assert.deepEqual(lesInnhold({ summarizations: [] }), { sammendrag: null, oppgaver: [] });
});

test("lista finnes uansett hva feltet heter", () => {
  assert.equal(lesListe([1, 2]).length, 2);
  assert.equal(lesListe({ data: [1] }).length, 1);
  assert.equal(lesListe({ recordings: [1, 2, 3] }).length, 3);
  assert.equal(lesListe({ noeAnnet: [1] }).length, 0);
  assert.equal(lesListe(null).length, 0);
});
