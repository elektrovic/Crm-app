import { strict as assert } from "node:assert";
import { test } from "node:test";
import { delOppAdresse, sammePunkt, tilSokestreng } from "./adresse";

test("adresser fra Tripletex deles opp uansett skrivemåte", () => {
  assert.deepEqual(delOppAdresse("Bekkeveien 4, 0596 Oslo"), {
    gate: "Bekkeveien 4",
    postnummer: "0596",
    poststed: "Oslo",
  });

  // Uten komma.
  assert.deepEqual(delOppAdresse("Bekkeveien 4 0596 Oslo"), {
    gate: "Bekkeveien 4",
    postnummer: "0596",
    poststed: "Oslo",
  });

  // Poststed med store bokstaver og ekstra mellomrom.
  assert.deepEqual(delOppAdresse("  Turbinveien 12,   0195   OSLO "), {
    gate: "Turbinveien 12",
    postnummer: "0195",
    poststed: "OSLO",
  });
});

test("adresse uten postnummer beholdes som gateadresse", () => {
  assert.deepEqual(delOppAdresse("Ullevålsveien 71"), {
    gate: "Ullevålsveien 71",
    postnummer: null,
    poststed: null,
  });
});

test("poststed i flere ord holder sammen", () => {
  assert.deepEqual(delOppAdresse("Storgata 22, 3300 Hokksund Sentrum"), {
    gate: "Storgata 22",
    postnummer: "3300",
    poststed: "Hokksund Sentrum",
  });
});

test("gatenummer forveksles ikke med postnummer", () => {
  // 1042 er husnummeret her, ikke et postnummer — det står ikke foran et sted.
  assert.deepEqual(delOppAdresse("Industriveien 1042"), {
    gate: "Industriveien 1042",
    postnummer: null,
    poststed: null,
  });
});

test("tom eller meningsløs adresse gir null", () => {
  assert.equal(delOppAdresse(""), null);
  assert.equal(delOppAdresse("   "), null);
  assert.equal(delOppAdresse(", 0596 Oslo"), null);
});

test("søkestrengen bruker postnummer og dropper poststed", () => {
  // Postnummeret er entydig; poststedet er bare en ny måte å bomme på.
  assert.equal(
    tilSokestreng({ gate: "Bekkeveien 4", postnummer: "0596", poststed: "Oslo" }),
    "Bekkeveien 4 0596",
  );
  assert.equal(
    tilSokestreng({ gate: "Ullevålsveien 71", postnummer: null, poststed: null }),
    "Ullevålsveien 71",
  );
});

test("sammePunkt skiller støy fra reell forskjell", () => {
  const a = { lat: 59.9432, lon: 10.8321 };
  assert.equal(sammePunkt(a, { lat: 59.94320001, lon: 10.83210001 }), true);
  // Rundt hundre meter unna er en reell forskjell.
  assert.equal(sammePunkt(a, { lat: 59.9442, lon: 10.8321 }), false);
});
