/**
 * Databaseskjema for Montørappen.
 *
 * To prinsipper styrer utformingen:
 *
 * 1. Tripletex er fasit for timer, prosjekter og ansatte. Vi speiler bare
 *    det vi trenger for å vise noe raskt og for å kunne jobbe offline —
 *    vi regner aldri ut på nytt det Tripletex allerede har svart.
 *
 * 2. `tenantId` ligger på hver eneste rad, selv om Halland er eneste kunde
 *    i dag. Det koster ingenting nå, og er forskjellen på uker og måneder
 *    den dagen systemet skal selges til kunde nummer to.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Kunder av systemet. I dag én rad: Halland. */
export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  navn: text("navn").notNull(),
  opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
});

export const ROLLER = ["montor", "leder", "admin"] as const;
export type Rolle = (typeof ROLLER)[number];

export const AVDELINGER = ["Elektro", "Lås og sikkerhet", "Eiendomspleie"] as const;
export type Avdeling = (typeof AVDELINGER)[number];

export const ansatte = pgTable(
  "ansatte",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),

    /** Objekt-ID fra Entra ID. Dette er den egentlige identiteten. */
    entraOid: text("entra_oid").notNull(),
    epost: text("epost").notNull(),
    navn: text("navn").notNull(),

    /** Kobling mot Tripletex-ansatt, brukes ved timeføring. */
    tripletexEmployeeId: integer("tripletex_employee_id"),
    /** Personlig employee token for Tripletex, kryptert før lagring. */
    tripletexTokenKryptert: text("tripletex_token_kryptert"),

    /** Bilen denne ansatte kjører, slik den heter i ABAX. */
    abaxVehicleId: text("abax_vehicle_id"),

    rolle: text("rolle").$type<Rolle>().notNull().default("montor"),
    avdeling: text("avdeling").$type<Avdeling>().notNull(),

    /** Fargekode og initialer styres av ledelsen under Admin → Bemanning. */
    farge: text("farge").notNull().default("#2563EB"),
    initialer: text("initialer").notNull(),

    aktiv: boolean("aktiv").notNull().default(true),
    opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("ansatte_entra_oid_idx").on(t.entraOid),
    index("ansatte_tenant_idx").on(t.tenantId),
  ],
);

/** Speil av prosjekter fra Tripletex, med det Tripletex ikke har. */
export const prosjekter = pgTable(
  "prosjekter",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),

    tripletexProjectId: integer("tripletex_project_id").notNull(),
    nummer: text("nummer").notNull(),
    navn: text("navn").notNull(),
    kunde: text("kunde"),
    adresse: text("adresse"),

    /** Koordinater brukes til å matche ABAX-stopp mot riktig prosjekt. */
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lon: numeric("lon", { precision: 9, scale: 6 }),

    avdeling: text("avdeling").$type<Avdeling>().notNull(),
    farge: text("farge").notNull().default("#2563EB"),
    aktiv: boolean("aktiv").notNull().default(true),
    sistSynket: timestamp("sist_synket", { withTimezone: true }),

    /**
     * Kobling til kunderaden i CRM-en. Settes av Tripletex-synken.
     * Ingen references() her fordi kunder-tabellen defineres lenger nede i
     * fila; fremmednøkkelen legges på i migrasjonen.
     */
    kundeId: uuid("kunde_id"),

    /**
     * Når vi sist forsøkte å slå opp koordinater for adressen.
     * Settes uansett om oppslaget traff, slik at synken ikke spør
     * Kartverket om den samme umulige adressen hver time.
     */
    geokodetForsokt: timestamp("geokodet_forsokt", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("prosjekt_tenant_tripletex_idx").on(t.tenantId, t.tripletexProjectId),
    index("prosjekt_nummer_idx").on(t.tenantId, t.nummer),
  ],
);

/**
 * Adkomstinfo — nøkkelkode, kontaktperson, parkering.
 * Oppdateres av den som var der sist, og sparer 5–10 min per ny jobb.
 */
export const adkomst = pgTable(
  "adkomst",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    prosjektId: uuid("prosjekt_id")
      .notNull()
      .references(() => prosjekter.id, { onDelete: "cascade" }),

    nokkelkode: text("nokkelkode"),
    kontaktperson: text("kontaktperson"),
    kontakttelefon: text("kontakttelefon"),
    parkering: text("parkering"),
    merknad: text("merknad"),

    oppdatertAv: uuid("oppdatert_av").references(() => ansatte.id),
    oppdatert: timestamp("oppdatert", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("adkomst_prosjekt_idx").on(t.prosjektId)],
);

/** Manglende materiell per prosjekt, med diktering og bestillingsstatus. */
export const mangler = pgTable(
  "mangler",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    prosjektId: uuid("prosjekt_id")
      .notNull()
      .references(() => prosjekter.id, { onDelete: "cascade" }),

    tekst: text("tekst").notNull(),
    antall: text("antall"),
    /** Sant når linja ble snakket inn i stedet for skrevet. */
    taltInn: boolean("talt_inn").notNull().default(false),

    /**
     * Varenummer, når montøren har det. EFO-nummeret identifiserer varen
     * entydig hos alle norske elektrogrossister, og gjør at bestillingen
     * kan sendes uten at noen må slå opp manuelt.
     */
    efoNummer: text("efo_nummer"),
    enhet: text("enhet").notNull().default("STK"),

    bestilt: boolean("bestilt").notNull().default(false),
    bestiltTidspunkt: timestamp("bestilt_tidspunkt", { withTimezone: true }),

    lagtInnAv: uuid("lagt_inn_av")
      .notNull()
      .references(() => ansatte.id),
    opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("mangler_prosjekt_idx").on(t.tenantId, t.prosjektId, t.bestilt)],
);

/**
 * Hvem som skal hvor, hvilken dag. Grunnlaget for «Din dag» i appen og for
 * uke-rutenettet under Admin → Bemanning.
 *
 * En montør ser bare sine egne rader. Det er ikke bare et visningsvalg:
 * spørringen filtreres i backend, slik at han aldri får kollegaenes jobber
 * i svaret i det hele tatt.
 */
export const tildelinger = pgTable(
  "tildelinger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),

    prosjektId: uuid("prosjekt_id")
      .notNull()
      .references(() => prosjekter.id, { onDelete: "cascade" }),
    ansattId: uuid("ansatt_id")
      .notNull()
      .references(() => ansatte.id, { onDelete: "cascade" }),

    dato: text("dato").notNull(), // ISO-dato, YYYY-MM-DD
    fraKl: text("fra_kl"), // "07:30"
    tilKl: text("til_kl"), // "12:00"
    notat: text("notat"),

    opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("tildeling_ansatt_dato_idx").on(t.tenantId, t.ansattId, t.dato),
    index("tildeling_dato_idx").on(t.tenantId, t.dato),
  ],
);

export const KO_STATUS = ["i_ko", "sender", "sendt", "feilet", "laast"] as const;
export type KoStatus = (typeof KO_STATUS)[number];

/**
 * Timeføringer. Raden lever her først, og sendes til Tripletex av
 * sendekøen. Da kan montøren føre timer uten dekning, og vi har vår egen
 * historikk å vise fram hvis Tripletex-kallet feiler.
 */
export const timeforinger = pgTable(
  "timeforinger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),

    ansattId: uuid("ansatt_id")
      .notNull()
      .references(() => ansatte.id),
    prosjektId: uuid("prosjekt_id")
      .notNull()
      .references(() => prosjekter.id),

    dato: text("dato").notNull(), // ISO-dato, YYYY-MM-DD
    timer: numeric("timer", { precision: 5, scale: 2 }).notNull(),
    aktivitetId: integer("aktivitet_id"),
    kommentar: text("kommentar"),

    /** Sant når linja kom fra et ABAX-kjørebokforslag montøren bekreftet. */
    fraKjorebok: boolean("fra_kjorebok").notNull().default(false),

    status: text("status").$type<KoStatus>().notNull().default("i_ko"),
    /** ID-en Tripletex ga oss, slik at vi ikke sender samme time to ganger. */
    tripletexEntryId: integer("tripletex_entry_id"),
    feilmelding: text("feilmelding"),
    forsok: integer("forsok").notNull().default(0),

    /** Idempotensnøkkel fra klienten, hindrer dobbeltføring ved dårlig nett. */
    klientNokkel: text("klient_nokkel").notNull(),

    opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
    sendt: timestamp("sendt", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("timeforing_klientnokkel_idx").on(t.tenantId, t.klientNokkel),
    index("timeforing_ansatt_dato_idx").on(t.tenantId, t.ansattId, t.dato),
    index("timeforing_status_idx").on(t.tenantId, t.status),
  ],
);

/**
 * Endringslogg. Dette er dokumentasjonen i en tvist om fakturert tid,
 * og et krav den dagen systemet selges. Raden skrives aldri om.
 */
export const endringslogg = pgTable(
  "endringslogg",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),

    ansattId: uuid("ansatt_id").references(() => ansatte.id),
    handling: text("handling").notNull(),
    tabell: text("tabell").notNull(),
    radId: text("rad_id"),

    /** Før- og etterverdier, slik at endringen kan rekonstrueres. */
    for: jsonb("for"),
    etter: jsonb("etter"),

    ipAdresse: text("ip_adresse"),
    tidspunkt: timestamp("tidspunkt", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("endringslogg_oppslag_idx").on(t.tenantId, t.tabell, t.radId)],
);

/* ================================================================
 * Fase 4 — dokumentasjon og kundekontakt
 * ============================================================== */

/**
 * Vedlegg: bilder fra jobben, og signaturer.
 *
 * Bildene komprimeres i nettleseren før opplasting, så en typisk rad er
 * 150–300 kB. Det holder lenge for Halland alene.
 *
 * MERK: dette er bevisst enkelt for å komme i drift. Når volumet vokser —
 * eller systemet får kunde nummer to — skal innholdet flyttes til
 * objektlagring og `data` byttes med en lagringsnøkkel. `lib/lagring.ts`
 * er det eneste stedet som må endres.
 */
export const vedlegg = pgTable(
  "vedlegg",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    prosjektId: uuid("prosjekt_id")
      .notNull()
      .references(() => prosjekter.id, { onDelete: "cascade" }),

    /** "bilde" eller "signatur". */
    slag: text("slag").notNull(),
    mimetype: text("mimetype").notNull(),
    /**
     * Selve fila, base64.
     *
     * Null når innholdet er ryddet bort etter oppbevaringstiden. Raden blir
     * stående, slik at appen fortsatt vet at bildet finnes — det ligger da
     * i Tripletex, som er arkivet.
     */
    data: text("data"),
    storrelse: integer("storrelse").notNull(),

    lastetOppAv: uuid("lastet_opp_av")
      .notNull()
      .references(() => ansatte.id),

    /**
     * Når fila ble lagt i Tripletex' dokumentarkiv. Er den null, ligger
     * bildet bare hos oss — og da skal kontoret slippe å lete i appen.
     */
    tripletexLastetOpp: timestamp("tripletex_lastet_opp", { withTimezone: true }),
    tripletexFeilmelding: text("tripletex_feilmelding"),

    /**
     * Når vår kopi av fila ble ryddet bort.
     *
     * Vi beholder bildet lokalt mens jobben er fersk, og sletter det etter
     * oppbevaringstiden — men bare når Tripletex har bekreftet at de har
     * det. Databasen vokser ikke i det uendelige, og posisjons- og bildedata
     * lagres ikke lenger enn formålet krever.
     */
    dataSlettet: timestamp("data_slettet", { withTimezone: true }),

    opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("vedlegg_prosjekt_idx").on(t.tenantId, t.prosjektId, t.slag)],
);

/**
 * Tillegg: arbeid utover tilbudet, med bilde og kundens signatur.
 *
 * Signaturen er dokumentasjonen for at kunden faktisk godkjente tillegget
 * på stedet. Den lagres sammen med hvem som signerte og når, og raden
 * endres aldri etter at den er signert.
 */
export const tillegg = pgTable(
  "tillegg",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    prosjektId: uuid("prosjekt_id")
      .notNull()
      .references(() => prosjekter.id),
    ansattId: uuid("ansatt_id")
      .notNull()
      .references(() => ansatte.id),

    /** Linja fra avdelingens prisliste. */
    navn: text("navn").notNull(),
    enhet: text("enhet"),
    antall: numeric("antall", { precision: 8, scale: 2 }).notNull().default("1"),
    /** Pris per enhet i kroner, slik den sto på prislista da tillegget ble ført. */
    enhetspris: numeric("enhetspris", { precision: 10, scale: 2 }).notNull(),
    kommentar: text("kommentar"),

    bildeId: uuid("bilde_id").references(() => vedlegg.id),
    signaturId: uuid("signatur_id").references(() => vedlegg.id),
    signertAv: text("signert_av"),
    signertTidspunkt: timestamp("signert_tidspunkt", { withTimezone: true }),

    status: text("status").$type<KoStatus>().notNull().default("i_ko"),
    /**
     * Underprosjektet i Tripletex som tillegget havnet på.
     * Underprosjekt er Tripletex' eget begrep for tilleggsarbeid, så det er
     * dit dette hører hjemme — kontoret fakturerer derfra.
     */
    tripletexUnderprosjektId: integer("tripletex_underprosjekt_id"),
    feilmelding: text("feilmelding"),
    klientNokkel: text("klient_nokkel").notNull(),

    opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("tillegg_klientnokkel_idx").on(t.tenantId, t.klientNokkel),
    index("tillegg_prosjekt_idx").on(t.tenantId, t.prosjektId),
  ],
);

/**
 * Utfylte kontrollskjema. Hvilke spørsmål som stilles kommer fra
 * avdelingen: sluttkontroll for elektro, egenkontroll adgangskontroll for
 * lås, SJA for eiendomspleie.
 */
export const skjemasvar = pgTable(
  "skjemasvar",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    prosjektId: uuid("prosjekt_id")
      .notNull()
      .references(() => prosjekter.id),
    ansattId: uuid("ansatt_id")
      .notNull()
      .references(() => ansatte.id),

    skjemaNavn: text("skjema_navn").notNull(),
    /** Ett svar per spørsmål: [{ sporsmal, svar }]. */
    svar: jsonb("svar").$type<{ sporsmal: string; svar: string }[]>().notNull(),
    /** Fritekstbeskrivelsen av arbeidet som er utført. */
    beskrivelse: text("beskrivelse"),

    fullfort: boolean("fullfort").notNull().default(false),
    klientNokkel: text("klient_nokkel").notNull(),
    opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("skjemasvar_klientnokkel_idx").on(t.tenantId, t.klientNokkel),
    index("skjemasvar_prosjekt_idx").on(t.tenantId, t.prosjektId),
  ],
);

export const SMS_ANLEDNING = ["for_oppdrag", "etter_oppdrag"] as const;
export type SmsAnledning = (typeof SMS_ANLEDNING)[number];

/**
 * Logg over meldinger sendt til kunde.
 *
 * Alt som er sendt skal kunne vises fram: hvem sendte, til hvilket nummer,
 * hva som sto der, og hva leverandøren svarte. En melding sendes aldri
 * automatisk — en montør har alltid trykket på knappen.
 */
export const smsLogg = pgTable(
  "sms_logg",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    prosjektId: uuid("prosjekt_id")
      .notNull()
      .references(() => prosjekter.id),
    ansattId: uuid("ansatt_id")
      .notNull()
      .references(() => ansatte.id),

    anledning: text("anledning").$type<SmsAnledning>().notNull(),
    mottaker: text("mottaker").notNull(),
    melding: text("melding").notNull(),

    sendt: boolean("sendt").notNull().default(false),
    leverandorId: text("leverandor_id"),
    feilmelding: text("feilmelding"),
    klientNokkel: text("klient_nokkel").notNull(),

    opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("sms_klientnokkel_idx").on(t.tenantId, t.klientNokkel),
    index("sms_prosjekt_idx").on(t.tenantId, t.prosjektId),
  ],
);

/**
 * Prisliste per avdeling.
 *
 * Ligger som data, ikke i koden. Ledelsen skal kunne endre en pris uten at
 * noen bygger appen på nytt, og en ny kunde skal kunne ha sine egne priser
 * uten at koden røres.
 */
export const prislinjer = pgTable(
  "prislinjer",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    avdeling: text("avdeling").$type<Avdeling>().notNull(),

    navn: text("navn").notNull(),
    enhet: text("enhet"),
    pris: numeric("pris", { precision: 10, scale: 2 }).notNull(),

    sortering: integer("sortering").notNull().default(0),
    aktiv: boolean("aktiv").notNull().default(true),
  },
  (t) => [index("prislinjer_avdeling_idx").on(t.tenantId, t.avdeling, t.aktiv)],
);

export type SkjemaSporsmal = {
  tekst: string;
  /** Svaralternativer. Tom liste betyr fritekst. */
  alternativer: string[];
};

/**
 * Malene for kontrollskjema, én per avdeling: sluttkontroll for elektro,
 * egenkontroll adgangskontroll for lås, SJA for eiendomspleie.
 * Også dette er data, av samme grunn som prislista.
 */
export const skjemamaler = pgTable(
  "skjemamaler",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    avdeling: text("avdeling").$type<Avdeling>().notNull(),

    navn: text("navn").notNull(),
    sporsmal: jsonb("sporsmal").$type<SkjemaSporsmal[]>().notNull(),
    /** Ledeteksten på fritekstfeltet til slutt. */
    beskrivelseLedetekst: text("beskrivelse_ledetekst"),

    aktiv: boolean("aktiv").notNull().default(true),
  },
  (t) => [index("skjemamaler_avdeling_idx").on(t.tenantId, t.avdeling, t.aktiv)],
);

/* ================================================================
 * Fase 5 — CRM og ledelsesflate
 * ============================================================== */

export const KUNDESTATUS = ["prospekt", "kunde", "tapt", "inaktiv"] as const;
export type Kundestatus = (typeof KUNDESTATUS)[number];

/**
 * Kunder.
 *
 * Omsetningstall leses fra Tripletex og speiles hit — de regnes aldri ut på
 * nytt her. Tripletex er fasit for penger; denne tabellen eier oppfølgingen.
 */
export const kunder = pgTable(
  "kunder",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),

    navn: text("navn").notNull(),
    /** Sameie, borettslag, entreprenør, privat … */
    type: text("type"),
    orgnummer: text("orgnummer"),

    kontaktperson: text("kontaktperson"),
    telefon: text("telefon"),
    epost: text("epost"),
    adresse: text("adresse"),

    avdeling: text("avdeling").$type<Avdeling>(),
    status: text("status").$type<Kundestatus>().notNull().default("prospekt"),

    tripletexCustomerId: integer("tripletex_customer_id"),
    /** Speilet fra Tripletex, med tidspunkt så vi vet hvor ferskt det er. */
    omsetning: numeric("omsetning", { precision: 12, scale: 2 }),
    omsetningSynket: timestamp("omsetning_synket", { withTimezone: true }),

    opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("kunder_tenant_idx").on(t.tenantId, t.status),
    index("kunder_navn_idx").on(t.tenantId, t.navn),
  ],
);

/**
 * Pipeline-trinnene for en henvendelse.
 *
 * Disse er gjettet ut fra prototypen og skal rettes når dere sier hva dere
 * faktisk kaller stegene. De ligger som en liste her, ikke spredt utover
 * koden, nettopp for at det skal være en liten endring.
 */
export const PIPELINE = [
  "ny",
  "kontaktet",
  "befaring_avtalt",
  "tilbud_sendt",
  "vunnet",
  "tapt",
] as const;
export type PipelineTrinn = (typeof PIPELINE)[number];

export const KANAL = ["telefon", "epost", "nettskjema", "anbefaling"] as const;
export type Kanal = (typeof KANAL)[number];

/**
 * Henvendelser fra telefon, e-post og nettskjema i én liste.
 *
 * AI-feltene er forslag, ikke fasit — de fylles av triageringen og skal
 * alltid kunne overstyres av et menneske. Derfor ligger de i egne kolonner,
 * atskilt fra det saksbehandleren selv har bestemt.
 */
export const henvendelser = pgTable(
  "henvendelser",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),

    kanal: text("kanal").$type<Kanal>().notNull(),
    mottatt: timestamp("mottatt", { withTimezone: true }).defaultNow().notNull(),

    /** Rådata slik den kom inn — telefonnotat, e-posttekst, skjemasvar. */
    innhold: text("innhold").notNull(),
    avsenderNavn: text("avsender_navn"),
    avsenderTelefon: text("avsender_telefon"),
    avsenderEpost: text("avsender_epost"),

    kundeId: uuid("kunde_id").references(() => kunder.id),
    trinn: text("trinn").$type<PipelineTrinn>().notNull().default("ny"),
    ansvarlig: uuid("ansvarlig").references(() => ansatte.id),
    avdeling: text("avdeling").$type<Avdeling>(),
    /** Antatt verdi i kroner, satt av saksbehandler. */
    sum: numeric("sum", { precision: 12, scale: 2 }),

    /* --- AI-forslag. Alltid forslag, aldri fasit. --- */
    aiSammendrag: text("ai_sammendrag"),
    aiKategori: text("ai_kategori"),
    aiHastegrad: text("ai_hastegrad"),
    aiVurdert: timestamp("ai_vurdert", { withTimezone: true }),
    /** Hvilken modell som svarte, så et rart forslag kan spores. */
    aiModell: text("ai_modell"),

    opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("henvendelser_trinn_idx").on(t.tenantId, t.trinn),
    index("henvendelser_mottatt_idx").on(t.tenantId, t.mottatt),
  ],
);

export const REKLAMASJONSSTATUS = ["ny", "under_behandling", "venter_kunde", "lukket"] as const;
export type Reklamasjonsstatus = (typeof REKLAMASJONSSTATUS)[number];

/**
 * Reklamasjoner.
 *
 * Feltene er valgt slik at en sak kan dokumenteres i en tvist: saksnummer,
 * når den kom inn, hvem som eier den, hva den kostet, og hva som ble gjort.
 */
export const reklamasjoner = pgTable(
  "reklamasjoner",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),

    saksnummer: text("saksnummer").notNull(),
    kundeId: uuid("kunde_id")
      .notNull()
      .references(() => kunder.id),
    prosjektId: uuid("prosjekt_id").references(() => prosjekter.id),

    mottatt: text("mottatt").notNull(), // ISO-dato
    frist: text("frist"), // ISO-dato
    beskrivelse: text("beskrivelse").notNull(),

    ansvarlig: uuid("ansvarlig").references(() => ansatte.id),
    status: text("status").$type<Reklamasjonsstatus>().notNull().default("ny"),
    kostnad: numeric("kostnad", { precision: 12, scale: 2 }),
    losning: text("losning"),

    lukket: timestamp("lukket", { withTimezone: true }),
    opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("reklamasjon_saksnummer_idx").on(t.tenantId, t.saksnummer),
    index("reklamasjon_status_idx").on(t.tenantId, t.status),
  ],
);

/**
 * Garanti og gjenkjøp: hva som er utført, når garantien løper ut, og hva
 * som bør anbefales neste gang. Grunnlaget for å ringe kunden før
 * konkurrenten gjør det.
 */
export const garantier = pgTable(
  "garantier",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),

    kundeId: uuid("kunde_id")
      .notNull()
      .references(() => kunder.id),
    prosjektId: uuid("prosjekt_id").references(() => prosjekter.id),

    utfort: text("utfort").notNull(),
    utfortDato: text("utfort_dato").notNull(), // ISO-dato
    garantiUtloper: text("garanti_utloper"), // ISO-dato
    anbefaling: text("anbefaling"),
    /** Når kunden bør kontaktes om gjenkjøp. */
    kontaktesEtter: text("kontaktes_etter"), // ISO-dato

    kontaktet: boolean("kontaktet").notNull().default(false),
    opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("garantier_kunde_idx").on(t.tenantId, t.kundeId)],
);

/**
 * Oppfølginger — alt som har en frist og en ansvarlig.
 *
 * Dette er inngangen til CRM-en: «Oppfølging i dag» leser herfra, sortert
 * med det som er over frist først. Ufordelte saker har `ansvarlig = null`
 * og vises tydelig, så de ikke blir liggende.
 */
export const oppfolginger = pgTable(
  "oppfolginger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),

    kundeId: uuid("kunde_id").references(() => kunder.id),
    henvendelseId: uuid("henvendelse_id").references(() => henvendelser.id, {
      onDelete: "cascade",
    }),
    reklamasjonId: uuid("reklamasjon_id").references(() => reklamasjoner.id, {
      onDelete: "cascade",
    }),

    hva: text("hva").notNull(),
    frist: text("frist").notNull(), // ISO-dato
    ansvarlig: uuid("ansvarlig").references(() => ansatte.id),

    fullfort: boolean("fullfort").notNull().default(false),
    fullfortTidspunkt: timestamp("fullfort_tidspunkt", { withTimezone: true }),

    opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("oppfolging_frist_idx").on(t.tenantId, t.fullfort, t.frist),
    index("oppfolging_ansvarlig_idx").on(t.tenantId, t.ansvarlig),
  ],
);

/** Historikk per kunde — det som vises i tidslinja i høyre panel. */
export const kundehistorikk = pgTable(
  "kundehistorikk",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    kundeId: uuid("kunde_id")
      .notNull()
      .references(() => kunder.id, { onDelete: "cascade" }),

    hendelse: text("hendelse").notNull(),
    dato: text("dato").notNull(), // ISO-dato
    farge: text("farge").notNull().default("#2563EB"),
    ansattId: uuid("ansatt_id").references(() => ansatte.id),

    opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("kundehistorikk_kunde_idx").on(t.tenantId, t.kundeId, t.dato)],
);

/**
 * Aktiviteter fra Tripletex, speilet hit.
 *
 * Timeføring krever en aktivitets-ID. Uten dette speilet måtte appen slå
 * opp mot Tripletex hver gang timeskjermen åpnes — og det ville ikke virket
 * i det hele tatt uten dekning.
 */
export const aktiviteter = pgTable(
  "aktiviteter",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),

    tripletexActivityId: integer("tripletex_activity_id").notNull(),
    navn: text("navn").notNull(),
    nummer: text("nummer"),
    fakturerbar: boolean("fakturerbar").notNull().default(true),

    /** Aktiviteten som er forhåndsvalgt for denne avdelingen. */
    standardForAvdeling: text("standard_for_avdeling").$type<Avdeling>(),

    aktiv: boolean("aktiv").notNull().default(true),
    sistSynket: timestamp("sist_synket", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("aktivitet_tenant_tripletex_idx").on(t.tenantId, t.tripletexActivityId),
    index("aktivitet_aktiv_idx").on(t.tenantId, t.aktiv),
  ],
);

export const BESTILLINGSSTATUS = [
  "kladd",
  "sendt",
  "bekreftet",
  "levert",
  "avvist",
] as const;
export type Bestillingsstatus = (typeof BESTILLINGSSTATUS)[number];

/**
 * Bestillinger av materiell.
 *
 * Denne modellen er laget for å kunne sendes til Ahlsell uten å bygges om.
 * Ahlsell tilbyr ikke et vanlig REST-API for bestilling — de kjører EDI
 * (ORDERS, ORDRSP, DESADV, INVOIC), PunchOut og prisfiler. Felles for alle
 * tre er at de trenger de samme opplysningene: kundenummer, referanse,
 * leveringsadresse, og linjer med varenummer, antall og enhet.
 *
 * Derfor ligger de opplysningene her allerede. Når e-handelsavtalen er på
 * plass er det bare transporten som skal skrives — `src/lib/ahlsell/` —
 * ikke datamodellen.
 */
export const bestillinger = pgTable(
  "bestillinger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),

    /** Løpenummer vi selv eier, brukt som referanse mot grossisten. */
    bestillingsnummer: text("bestillingsnummer").notNull(),
    prosjektId: uuid("prosjekt_id")
      .notNull()
      .references(() => prosjekter.id),
    bestiltAv: uuid("bestilt_av")
      .notNull()
      .references(() => ansatte.id),

    /** Grossist. I dag alltid «ahlsell», men feltet er der for neste. */
    grossist: text("grossist").notNull().default("ahlsell"),
    /** Vårt kundenummer hos grossisten. */
    kundenummer: text("kundenummer"),

    leveringsadresse: text("leveringsadresse"),
    onsketLeveringsdato: text("onsket_leveringsdato"), // ISO-dato
    merknad: text("merknad"),

    status: text("status").$type<Bestillingsstatus>().notNull().default("kladd"),
    /** Ordrenummeret grossisten svarer med, når vi får et. */
    grossistOrdrenummer: text("grossist_ordrenummer"),
    sendt: timestamp("sendt", { withTimezone: true }),
    feilmelding: text("feilmelding"),

    opprettet: timestamp("opprettet", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("bestilling_nummer_idx").on(t.tenantId, t.bestillingsnummer),
    index("bestilling_status_idx").on(t.tenantId, t.status),
  ],
);

/**
 * Linjene i en bestilling.
 *
 * `efoNummer` er nøkkelen for elektro: EFObasen er varedatabasen norske
 * elektrogrossister bruker, og et EFO-nummer identifiserer varen entydig
 * hos alle av dem. `grossistVarenummer` er Ahlsells eget nummer der vi har
 * det. Har vi ingen av delene, sendes fritekst — da må noen hos grossisten
 * slå opp manuelt, men bestillingen kommer i det minste fram.
 */
export const bestillingslinjer = pgTable(
  "bestillingslinjer",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    bestillingId: uuid("bestilling_id")
      .notNull()
      .references(() => bestillinger.id, { onDelete: "cascade" }),

    /** Manglerlinja denne kom fra, når den kom derfra. */
    mangelId: uuid("mangel_id").references(() => mangler.id),

    beskrivelse: text("beskrivelse").notNull(),
    efoNummer: text("efo_nummer"),
    grossistVarenummer: text("grossist_varenummer"),

    antall: numeric("antall", { precision: 10, scale: 2 }).notNull().default("1"),
    /** STK, M, PK — enhetskodene grossisten forventer. */
    enhet: text("enhet").notNull().default("STK"),

    sortering: integer("sortering").notNull().default(0),
  },
  (t) => [index("bestillingslinje_bestilling_idx").on(t.tenantId, t.bestillingId)],
);
