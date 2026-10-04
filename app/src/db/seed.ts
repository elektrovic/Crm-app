/**
 * Seed for utvikling.
 *
 * Legger inn Halland som kunde, tre montører med hver sin fargekode, og
 * prosjektene fra prototypen med koordinater — slik at kjørebokforslagene
 * kan testes uten å ringe ABAX.
 *
 * Kjøres med: npm run db:seed
 * Trygg å kjøre flere ganger: finner den demodata fra før, lar den alt
 * stå og avslutter. Se guarden nederst i denne kommentaren.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "./index";
import {
  adkomst,
  mangler,
  medbring,
  aktiviteter,
  ansatte,
  garantier,
  henvendelser,
  kundehistorikk,
  kunder,
  oppfolginger,
  prislinjer,
  prosjekter,
  reklamasjoner,
  skjemamaler,
  tenants,
  tildelinger,
  tillegg,
  timeforinger,
} from "./schema";

const TENANT = process.env.DEFAULT_TENANT_ID ?? "halland";

async function seed() {
  console.log("Legger inn testdata…");

  // De fleste demotabellene har ingen naturlig nøkkel å kollidere på —
  // kunder, henvendelser, reklamasjoner og oppfølginger kan hete det
  // samme uten å være det samme. `onConflictDoNothing` gjør derfor
  // ingenting for dem, og en ny kjøring ville lagt inn alt på nytt.
  //
  // Det er ikke et teoretisk problem: med SEED_VED_BYGG=1 kjører dette
  // ved hvert eneste bygg, og demoen ville fylt seg opp med duplikater.
  //
  // Derfor: har denne kunden fått demodata før, lar vi det stå.
  const [finnes] = await db
    .select({ antall: sql<number>`count(*)`.mapWith(Number) })
    .from(kunder)
    .where(eq(kunder.tenantId, TENANT));

  if ((finnes?.antall ?? 0) > 0) {
    console.log("Demodata ligger inne fra før — hopper over.");
    console.log("Vil du ha dem på nytt, må de gamle radene slettes først.");
    process.exit(0);
  }

  await db
    .insert(tenants)
    .values({ id: TENANT, navn: "Halland Gruppen" })
    .onConflictDoNothing();

  const [montor] = await db
    .insert(ansatte)
    .values({
      tenantId: TENANT,
      // Byttes ut med den ekte objekt-ID-en fra Entra ID.
      entraOid: "seed-oid-tore",
      epost: "tore@hallandgroup.no",
      navn: "Tore Eriksen",
      rolle: "montor",
      avdeling: "Elektro",
      farge: "#2563EB",
      initialer: "TE",
      tripletexEmployeeId: null,
      abaxVehicleId: null,
    })
    .onConflictDoNothing()
    .returning();

  const [leder] = await db
    .insert(ansatte)
    .values([
      {
        tenantId: TENANT,
        entraOid: "seed-oid-marius",
        epost: "marius@hallandgroup.no",
        navn: "Marius Kvam",
        rolle: "leder",
        avdeling: "Elektro",
        farge: "#F97316",
        initialer: "MK",
      },
      {
        tenantId: TENANT,
        entraOid: "seed-oid-lise",
        epost: "lise@hallandgroup.no",
        navn: "Lise Aasheim",
        rolle: "montor",
        avdeling: "Lås og sikkerhet",
        farge: "#A855F7",
        initialer: "LA",
      },
    ])
    .onConflictDoNothing()
    .returning();

  // Prosjektene fra prototypen, med koordinater slik at ABAX-stopp kan
  // matches mot riktig adresse.
  const rader = await db
    .insert(prosjekter)
    .values([
      {
        tenantId: TENANT,
        tripletexProjectId: 100142,
        nummer: "1042",
        navn: "Nybygg Vollebekk – leil. B3–B7",
        kunde: "Selvaag Bolig AS",
        adresse: "Bekkeveien 4, 0596 Oslo",
        lat: "59.943200",
        lon: "10.832100",
        avdeling: "Elektro",
        farge: "#2563EB",
      },
      {
        tenantId: TENANT,
        tripletexProjectId: 100127,
        nummer: "1027",
        navn: "Serviceoppdrag Storgata 22",
        kunde: "Storgata Eiendom AS",
        adresse: "Storgata 22, 0184 Oslo",
        lat: "59.915500",
        lon: "10.756200",
        avdeling: "Elektro",
        farge: "#F97316",
      },
      {
        tenantId: TENANT,
        tripletexProjectId: 100093,
        nummer: "0993",
        navn: "Utvidelse tavle Kværnerbyen",
        kunde: "OBOS Prosjekt AS",
        adresse: "Turbinveien 12, 0195 Oslo",
        lat: "59.904700",
        lon: "10.786300",
        avdeling: "Elektro",
        farge: "#A855F7",
      },
      // Alle tre avdelingene må være representert. Uten dette viser
      // «Tilleggssalg per avdeling» på dashbordet bare Elektro, og
      // prislinjene for lås og eiendomspleie får ingen jobb å høre til.
      {
        tenantId: TENANT,
        tripletexProjectId: 100301,
        nummer: "3016",
        navn: "Adgangskontroll Nydalen",
        kunde: "Nydalen Næringspark AS",
        adresse: "Gjerdrums vei 10, 0484 Oslo",
        lat: "59.949500",
        lon: "10.760800",
        avdeling: "Lås og sikkerhet",
        farge: "#6366F1",
      },
      {
        tenantId: TENANT,
        tripletexProjectId: 100207,
        nummer: "2071",
        navn: "Takvask Ullevålsveien 71",
        kunde: "Sameiet Ullevålsveien 71",
        adresse: "Ullevålsveien 71, 0454 Oslo",
        lat: "59.934900",
        lon: "10.738600",
        avdeling: "Eiendomspleie",
        farge: "#22C55E",
      },
    ])
    .onConflictDoNothing()
    .returning();

  // Setter montøren opp på dagens to første jobber.
  if (montor && rader.length >= 2) {
    const idag = new Date().toISOString().slice(0, 10);
    await db
      .insert(tildelinger)
      .values([
        {
          tenantId: TENANT,
          prosjektId: rader[0]!.id,
          ansattId: montor.id,
          dato: idag,
          fraKl: "07:30",
          tilKl: "12:00",
        },
        {
          tenantId: TENANT,
          prosjektId: rader[1]!.id,
          ansattId: montor.id,
          dato: idag,
          fraKl: "12:30",
          tilKl: "15:00",
        },
      ])
      .onConflictDoNothing();
  }


  // Prislister og kontrollskjema per avdeling, hentet fra prototypen.
  // Disse ligger som data nettopp for at ledelsen skal kunne endre en pris
  // uten at noen bygger appen på nytt.
  await db
    .insert(prislinjer)
    .values([
      { tenantId: TENANT, avdeling: "Elektro", navn: "Ekstra stikkontakt, dobbel", enhet: "per punkt, inkl. montasje", pris: "1450", sortering: 1 },
      { tenantId: TENANT, avdeling: "Elektro", navn: "Downlight inkl. montasje", enhet: "per stk", pris: "890", sortering: 2 },
      { tenantId: TENANT, avdeling: "Elektro", navn: "Kabelgjennomføring brannklasse", enhet: "per gjennomføring", pris: "1250", sortering: 3 },
      { tenantId: TENANT, avdeling: "Elektro", navn: "Ekstra kurs i tavle", enhet: "per kurs", pris: "2300", sortering: 4 },

      { tenantId: TENANT, avdeling: "Lås og sikkerhet", navn: "Ekstra sylinder med nøkler", enhet: "per dør", pris: "1190", sortering: 1 },
      { tenantId: TENANT, avdeling: "Lås og sikkerhet", navn: "Justering av dørautomatikk", enhet: "per dør", pris: "1650", sortering: 2 },
      { tenantId: TENANT, avdeling: "Lås og sikkerhet", navn: "Kodelås utvendig", enhet: "per stk, inkl. montasje", pris: "3400", sortering: 3 },
      { tenantId: TENANT, avdeling: "Lås og sikkerhet", navn: "Nøkkelskap 30 kroker", enhet: "per stk", pris: "2250", sortering: 4 },

      { tenantId: TENANT, avdeling: "Eiendomspleie", navn: "Impregnering tak", enhet: "per m², etter vask", pris: "45", sortering: 1 },
      { tenantId: TENANT, avdeling: "Eiendomspleie", navn: "Algebehandling", enhet: "per m²", pris: "28", sortering: 2 },
      { tenantId: TENANT, avdeling: "Eiendomspleie", navn: "Rens av takrenner", enhet: "per løpemeter", pris: "65", sortering: 3 },
      { tenantId: TENANT, avdeling: "Eiendomspleie", navn: "Bytte knekt takstein", enhet: "per stk, inkl. materiell", pris: "190", sortering: 4 },
    ])
    .onConflictDoNothing();

  await db
    .insert(skjemamaler)
    .values([
      {
        tenantId: TENANT,
        avdeling: "Elektro",
        navn: "Sluttkontroll",
        beskrivelseLedetekst: "Beskriv arbeidet som er utført",
        sporsmal: [
          { tekst: "Er anlegget spenningssatt og sluttmålt?", alternativer: ["Ja", "Nei", "Ikke relevant"] },
          { tekst: "Er jordfeilbryter testet med testknapp og instrument?", alternativer: ["Ja, begge deler", "Kun testknapp", "Ikke utført"] },
          { tekst: "Er kursfortegnelsen oppdatert i tavla?", alternativer: ["Ja", "Nei"] },
        ],
      },
      {
        tenantId: TENANT,
        avdeling: "Lås og sikkerhet",
        navn: "Egenkontroll adgangskontroll",
        beskrivelseLedetekst: "Beskriv arbeidet som er utført",
        sporsmal: [
          { tekst: "Er alle sylindre montert og testet med nøkkel?", alternativer: ["Ja", "Nei", "Delvis"] },
          { tekst: "Er adgangsprofilene lagt inn og verifisert?", alternativer: ["Ja", "Nei", "Ikke relevant"] },
          { tekst: "Er nødåpning og rømningsvei testet?", alternativer: ["Ja", "Nei"] },
        ],
      },
      {
        tenantId: TENANT,
        avdeling: "Eiendomspleie",
        navn: "SJA – høyde og kjemikalier",
        beskrivelseLedetekst: "Skriv risikovurderingen for jobben",
        sporsmal: [
          { tekst: "Skal det arbeides høyere enn 2 meter over bakken?", alternativer: ["Ja", "Nei"] },
          { tekst: "Hvilken adkomst brukes på jobben?", alternativer: ["Stige", "Stillas", "Personløfter"] },
          { tekst: "Er fallsikring montert og kontrollert før arbeidet startet?", alternativer: ["Ja", "Nei", "Ikke relevant"] },
        ],
      },
    ])
    .onConflictDoNothing();

  // Adkomstinfo på det første prosjektet, så kortet har noe å vise.
  if (montor && rader[0]) {
    await db
      .insert(adkomst)
      .values({
        tenantId: TENANT,
        prosjektId: rader[0].id,
        nokkelkode: "1975*",
        kontaktperson: "Bjørn Sæther, byggeleder",
        kontakttelefon: "922 41 088",
        parkering: "Anleggsparkering bak brakkeriggen, skilt merket Selvaag.",
        merknad: "Heis går kun til 5. etasje. Bruk trapp videre opp.",
        oppdatertAv: montor.id,
      })
      .onConflictDoNothing();
  }


  // --- CRM-data, hentet fra prototypen ---
  const [kunde] = await db
    .insert(kunder)
    .values({
      tenantId: TENANT,
      navn: "Sameiet Ullevålsveien 71",
      type: "Sameie",
      avdeling: "Eiendomspleie",
      status: "kunde",
      kontaktperson: "Bjørn Sæther, styreleder",
      telefon: "922 41 088",
      epost: "styret@ullevalsveien71.no",
      adresse: "Ullevålsveien 71, 0454 Oslo",
      omsetning: "214500",
      omsetningSynket: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  const [kunde2] = await db
    .insert(kunder)
    .values({
      tenantId: TENANT,
      navn: "Selvaag Bolig AS",
      type: "Entreprenør",
      avdeling: "Elektro",
      status: "kunde",
      kontaktperson: "Bjørn Sæther, byggeleder",
      telefon: "922 41 088",
      adresse: "Bekkeveien 4, 0596 Oslo",
      omsetning: "1284000",
      omsetningSynket: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  // Koble prosjektene til kunderaden, slik at «antall prosjekter» stemmer.
  if (kunde2 && rader[0]) {
    await db
      .update(prosjekter)
      .set({ kundeId: kunde2.id })
      .where(eq(prosjekter.id, rader[0].id));
  }

  if (kunde) {
    await db
      .insert(kundehistorikk)
      .values([
        {
          tenantId: TENANT,
          kundeId: kunde.id,
          hendelse: "Takvask utført. Før- og etterbilder lagret på prosjektet",
          dato: "2026-09-02",
          farge: "#22C55E",
        },
        {
          tenantId: TENANT,
          kundeId: kunde.id,
          hendelse: "Tilbud signert med angrerettskjema",
          dato: "2026-08-12",
          farge: "#2563EB",
        },
      ])
      .onConflictDoNothing();

    await db
      .insert(garantier)
      .values({
        tenantId: TENANT,
        kundeId: kunde.id,
        utfort: "Takvask og impregnering",
        utfortDato: "2026-09-02",
        garantiUtloper: "2029-09-02",
        anbefaling: "Algebehandling ved neste besøk",
        kontaktesEtter: "2026-09-04",
      })
      .onConflictDoNothing();

    await db
      .insert(reklamasjoner)
      .values({
        tenantId: TENANT,
        saksnummer: "R-2026-014",
        kundeId: kunde.id,
        mottatt: "2026-08-28",
        frist: "2026-09-11",
        beskrivelse: "Misfarging på nordre takflate etter vask",
        status: "under_behandling",
        kostnad: "4200",
        ansvarlig: leder?.id ?? null,
      })
      .onConflictDoNothing();

    await db
      .insert(oppfolginger)
      .values([
        {
          tenantId: TENANT,
          kundeId: kunde.id,
          hva: "Ring om impregnering av tak",
          frist: "2026-09-04",
          ansvarlig: leder?.id ?? null,
        },
        {
          tenantId: TENANT,
          kundeId: kunde.id,
          hva: "Send dokumentasjon på reklamasjon R-2026-014",
          frist: "2026-09-11",
          // Ufordelt med vilje, så lista viser hvordan de merkes.
          ansvarlig: null,
        },
      ])
      .onConflictDoNothing();
  }

  await db
    .insert(henvendelser)
    .values([
      {
        tenantId: TENANT,
        kanal: "telefon",
        innhold:
          "Ringte inn: sikringsskapet i oppgangen slår ut med jevne mellomrom, " +
          "og nå er det mørkt i kjelleren. Beboere i fem leiligheter berørt. " +
          "Ønsker noen ut i dag hvis mulig.",
        avsenderNavn: "Anne Lie",
        avsenderTelefon: "915 22 340",
        kundeId: kunde2?.id ?? null,
        trinn: "ny",
        avdeling: "Elektro",
      },
      {
        tenantId: TENANT,
        kanal: "nettskjema",
        innhold:
          "Hei! Vi vurderer å bytte alle sylindre i inngangsdørene i borettslaget " +
          "(24 dører). Kan dere komme på befaring og gi et tilbud? Ingen hast.",
        avsenderNavn: "Boligbyggelaget Torshov",
        avsenderEpost: "post@torshovbbl.no",
        trinn: "kontaktet",
        avdeling: "Lås og sikkerhet",
        sum: "42000",
      },
      {
        tenantId: TENANT,
        kanal: "epost",
        innhold:
          "Viser til befaring forrige uke. Styret har godkjent tilbudet på " +
          "fasadevask. Når kan dere starte?",
        avsenderNavn: "Bygdøy Allé Sameie",
        avsenderEpost: "styret@bygdoyalle12.no",
        trinn: "tilbud_sendt",
        avdeling: "Eiendomspleie",
        sum: "68500",
      },
    ])
    .onConflictDoNothing();

  // Aktiviteter. I drift kommer disse fra Tripletex-synken; her legges det
  // inn nok til at timeskjermen kan brukes før første synk.
  await db
    .insert(aktiviteter)
    .values([
      { tenantId: TENANT, tripletexActivityId: 9001, navn: "Montasje", nummer: "100", standardForAvdeling: "Elektro" },
      { tenantId: TENANT, tripletexActivityId: 9002, navn: "Service og feilsøking", nummer: "110" },
      { tenantId: TENANT, tripletexActivityId: 9003, navn: "Låsmontasje", nummer: "200", standardForAvdeling: "Lås og sikkerhet" },
      { tenantId: TENANT, tripletexActivityId: 9004, navn: "Utvendig vask", nummer: "300", standardForAvdeling: "Eiendomspleie" },
      { tenantId: TENANT, tripletexActivityId: 9005, navn: "Internt - verksted og bil", nummer: "900", fakturerbar: false },
    ])
    .onConflictDoNothing();

  // Timer og tillegg. Uten disse står ledelsens dashboard tomt, og da ser
  // det ødelagt ut selv om det virker. Datoene regnes ut fra dagen seeden
  // kjøres, så tallene er ferske uansett når det skjer.
  const alleProsjekter = await db
    .select({ id: prosjekter.id, avdeling: prosjekter.avdeling })
    .from(prosjekter)
    .where(eq(prosjekter.tenantId, TENANT));

  const alleAnsatte = await db
    .select({ id: ansatte.id, avdeling: ansatte.avdeling })
    .from(ansatte)
    .where(eq(ansatte.tenantId, TENANT));

  if (alleProsjekter.length > 0 && alleAnsatte.length > 0) {
    const iDag = new Date();
    const timerader = [];

    // To uker bakover, hverdager, varierte timetall.
    for (let dagerSiden = 0; dagerSiden < 14; dagerSiden++) {
      const d = new Date(iDag);
      d.setUTCDate(d.getUTCDate() - dagerSiden);
      const ukedag = d.getUTCDay();
      if (ukedag === 0 || ukedag === 6) continue;
      const dato = d.toISOString().slice(0, 10);

      for (const [i, ansatt] of alleAnsatte.entries()) {
        const prosjekt = alleProsjekter[(dagerSiden + i) % alleProsjekter.length];
        if (!prosjekt) continue;
        timerader.push({
          tenantId: TENANT,
          ansattId: ansatt.id,
          prosjektId: prosjekt.id,
          dato,
          timer: String(6 + ((dagerSiden + i) % 3)),
          kommentar: null,
          status: "sendt" as const,
          klientNokkel: `seed-timer-${dato}-${ansatt.id}`,
        });
      }
    }

    await db.insert(timeforinger).values(timerader).onConflictDoNothing();

    // Tillegg med alle tre køstatusene, så sendekøen på dashbordet viser
    // hvordan den faktisk ser ut når noe venter og noe har feilet.
    const prisrader = await db
      .select({ navn: prislinjer.navn, enhet: prislinjer.enhet, pris: prislinjer.pris, avdeling: prislinjer.avdeling })
      .from(prislinjer)
      .where(eq(prislinjer.tenantId, TENANT));

    const statuser = ["sendt", "sendt", "sendt", "i_ko", "feilet"] as const;
    const tilleggsrader = prisrader.slice(0, 10).map((pris, i) => {
      const prosjekt =
        alleProsjekter.find((p) => p.avdeling === pris.avdeling) ?? alleProsjekter[0]!;
      const ansatt = alleAnsatte[i % alleAnsatte.length]!;
      const status = statuser[i % statuser.length]!;
      return {
        tenantId: TENANT,
        prosjektId: prosjekt.id,
        ansattId: ansatt.id,
        navn: pris.navn,
        enhet: pris.enhet,
        antall: String(1 + (i % 3)),
        enhetspris: pris.pris,
        status,
        feilmelding: status === "feilet" ? "Perioden er låst i Tripletex" : null,
        klientNokkel: `seed-tillegg-${i}`,
      };
    });

    await db.insert(tillegg).values(tilleggsrader).onConflictDoNothing();
  }

  // --- Kalenderuke: noe å se på i planleggingen ---
  //
  // Dagens to jobber ligger alt over. Her fylles resten av uka, så
  // rutenettet viser et realistisk bilde: to montører, overlapp på ett
  // bygg, og en jobb som går over flere dager.
  // Lise settes inn sammen med Marius lenger oppe, så hun hentes her
  // i stedet for å endre destruktureringen der.
  const [lise] = await db
    .select({ id: ansatte.id })
    .from(ansatte)
    .where(and(eq(ansatte.tenantId, TENANT), eq(ansatte.epost, "lise@hallandgroup.no")));

  if (montor && lise && rader.length >= 5) {
    const dag = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };

    await db
      .insert(tildelinger)
      .values([
        // Tore videre på Vollebekk ut uka.
        { tenantId: TENANT, prosjektId: rader[0]!.id, ansattId: montor.id, dato: dag(1), fraKl: "07:30", tilKl: "15:00" },
        { tenantId: TENANT, prosjektId: rader[0]!.id, ansattId: montor.id, dato: dag(2), fraKl: "07:30", tilKl: "15:00" },
        // Kværnerbyen torsdag, med beskjed.
        {
          tenantId: TENANT,
          prosjektId: rader[2]!.id,
          ansattId: montor.id,
          dato: dag(3),
          fraKl: "08:00",
          tilKl: "14:00",
          notat: "Tavla er spenningssatt. Avtal utkobling med driftsleder før du starter.",
        },
        // Lise på lås, og onsdag møtes de to på samme bygg.
        { tenantId: TENANT, prosjektId: rader[3]!.id, ansattId: lise.id, dato: dag(1), fraKl: "08:00", tilKl: "16:00" },
        { tenantId: TENANT, prosjektId: rader[0]!.id, ansattId: lise.id, dato: dag(2), fraKl: "10:00", tilKl: "14:00" },
      ])
      .onConflictDoNothing();

    // Mangler noen har meldt inn, så pakkelista har noe å hake av fra.
    const meldt = await db
      .insert(mangler)
      .values([
        { tenantId: TENANT, prosjektId: rader[0]!.id, tekst: "Kabelstige 300 mm", antall: "6", enhet: "M", lagtInnAv: montor.id },
        { tenantId: TENANT, prosjektId: rader[0]!.id, tekst: "Jordingsklemmer", antall: "20", enhet: "STK", lagtInnAv: montor.id },
        { tenantId: TENANT, prosjektId: rader[0]!.id, tekst: "Automat 16A C-kurve", antall: "4", enhet: "STK", lagtInnAv: montor.id, bestilt: true, bestiltTidspunkt: new Date() },
        { tenantId: TENANT, prosjektId: rader[2]!.id, tekst: "Skinnebryter 63A", antall: "1", enhet: "STK", lagtInnAv: montor.id },
      ])
      .onConflictDoNothing()
      .returning();

    // En ferdig pakkeliste på morgendagens jobb: to fra manglene, én
    // skrevet av lederen, og én alt krysset av.
    const [morgendagen] = await db
      .select({ id: tildelinger.id })
      .from(tildelinger)
      .where(and(eq(tildelinger.ansattId, montor.id), eq(tildelinger.dato, dag(1))));

    if (morgendagen && meldt.length >= 2) {
      await db
        .insert(medbring)
        .values([
          { tenantId: TENANT, tildelingId: morgendagen.id, mangelId: meldt[0]!.id, tekst: meldt[0]!.tekst, antall: meldt[0]!.antall, enhet: meldt[0]!.enhet, sortering: 0, pakket: true, pakketTidspunkt: new Date() },
          { tenantId: TENANT, tildelingId: morgendagen.id, mangelId: meldt[1]!.id, tekst: meldt[1]!.tekst, antall: meldt[1]!.antall, enhet: meldt[1]!.enhet, sortering: 1 },
          { tenantId: TENANT, tildelingId: morgendagen.id, tekst: "Stigen fra verkstedet", antall: "1", enhet: "STK", sortering: 2 },
        ])
        .onConflictDoNothing();
    }
  }

  console.log("Ferdig.");
  console.log(
    "Husk å bytte entraOid på de tre ansatte til de ekte verdiene fra Entra ID " +
      "før noen skal logge inn på ordentlig.",
  );
  process.exit(0);
}

seed().catch((feil) => {
  console.error("Seed feilet:", feil);
  process.exit(1);
});
