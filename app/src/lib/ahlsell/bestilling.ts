/**
 * Bestillingsdokumentet.
 *
 * Dette er den kanoniske formen på en bestilling hos oss. Alt som skal ut
 * til en grossist bygges herfra, uansett hvilken vei det går ut.
 *
 * Bakgrunnen: Ahlsell tilbyr ikke et vanlig REST-API for bestilling. De
 * kjører EDI (ORDERS, ORDRSP, DESADV, INVOIC), PunchOut og prisfiler. Alle
 * tre trenger de samme opplysningene — kundenummer, vår referanse,
 * leveringsadresse, og linjer med varenummer, antall og enhet. Så vi
 * samler dem ett sted, og lar transporten være et bytte av renderer.
 *
 * Ren modul uten I/O, slik at formatene kan testes uten å sende noe.
 */

/** Enhetskodene grossistene bruker. Samsvarer med UN/ECE Rec 20. */
export const ENHETER = ["STK", "M", "PK", "KG", "RL", "SET"] as const;
export type Enhet = (typeof ENHETER)[number];

export type Bestillingslinje = {
  /** Løpenummer i bestillingen, 1-basert. */
  linjenummer: number;
  beskrivelse: string;
  /** EFO-nummer identifiserer varen entydig hos norske elektrogrossister. */
  efoNummer?: string | null;
  /** Grossistens eget varenummer, der vi har det. */
  grossistVarenummer?: string | null;
  antall: number;
  enhet: Enhet;
};

export type Bestillingsdokument = {
  bestillingsnummer: string;
  /** Vårt kundenummer hos grossisten. */
  kundenummer?: string | null;
  /** Prosjektnummeret bestillingen skal merkes med. */
  prosjektnummer: string;
  prosjektnavn: string;
  leveringsadresse?: string | null;
  onsketLeveringsdato?: string | null;
  bestiltAv: string;
  merknad?: string | null;
  linjer: Bestillingslinje[];
};

export class BestillingsFeil extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BestillingsFeil";
  }
}

/**
 * Sjekker at dokumentet er komplett nok til å sendes.
 *
 * Bedre å stoppe her enn å sende en bestilling grossisten må ringe om.
 * Returnerer en liste med det som mangler; tom liste betyr klar til sending.
 */
export function finnMangler(dok: Bestillingsdokument): string[] {
  const feil: string[] = [];

  if (dok.linjer.length === 0) feil.push("Bestillingen har ingen linjer.");
  if (!dok.bestillingsnummer.trim()) feil.push("Mangler bestillingsnummer.");
  if (!dok.prosjektnummer.trim()) feil.push("Mangler prosjektnummer.");

  for (const l of dok.linjer) {
    if (l.antall <= 0) {
      feil.push(`Linje ${l.linjenummer} har antall ${l.antall}.`);
    }
    if (!l.beskrivelse.trim()) {
      feil.push(`Linje ${l.linjenummer} mangler beskrivelse.`);
    }
  }

  return feil;
}

/**
 * Linjer uten varenummer må slås opp manuelt hos grossisten.
 * Vi stopper ikke bestillingen for det, men sier fra i grensesnittet.
 */
export function linjerUtenVarenummer(dok: Bestillingsdokument): Bestillingslinje[] {
  return dok.linjer.filter((l) => !l.efoNummer && !l.grossistVarenummer);
}

/** Norsk tallformat med punktum som desimalskille, slik filformater vil ha det. */
function tall(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * CSV-eksport.
 *
 * Dette er formatet som virker i dag: grossistens e-handelsavdeling kan
 * lese det direkte, og det kan mappes til EDI uten tap når avtalen er på
 * plass. Semikolon som skilletegn, som er norsk konvensjon.
 */
export function tilCsv(dok: Bestillingsdokument): string {
  const skille = ";";

  const escape = (v: string | number | null | undefined): string => {
    const s = String(v ?? "");
    // Anførselstegn dobles, og felt med skilletegn eller linjeskift siteres.
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const hode = [
    "Bestillingsnummer",
    "Kundenummer",
    "Prosjektnummer",
    "Linjenummer",
    "EFO-nummer",
    "Varenummer",
    "Beskrivelse",
    "Antall",
    "Enhet",
    "Leveringsadresse",
    "Ønsket levering",
  ];

  const rader = dok.linjer.map((l) =>
    [
      dok.bestillingsnummer,
      dok.kundenummer,
      dok.prosjektnummer,
      l.linjenummer,
      l.efoNummer,
      l.grossistVarenummer,
      l.beskrivelse,
      tall(l.antall),
      l.enhet,
      dok.leveringsadresse,
      dok.onsketLeveringsdato,
    ]
      .map(escape)
      .join(skille),
  );

  // CRLF, som er det regneark og EDI-verktøy forventer.
  return [hode.join(skille), ...rader].join("\r\n") + "\r\n";
}

/**
 * Lesbar bestilling til e-post.
 *
 * Brukes i dag, og er fortsatt nyttig etterpå: en innkjøper vil gjerne se
 * hva som ble sendt uten å åpne en EDI-fil.
 */
export function tilTekst(dok: Bestillingsdokument): string {
  const linjer = dok.linjer.map((l) => {
    const nummer = l.efoNummer
      ? `EFO ${l.efoNummer}`
      : l.grossistVarenummer
        ? `Varenr ${l.grossistVarenummer}`
        : "uten varenummer";
    return `${String(l.linjenummer).padStart(2, " ")}. ${tall(l.antall)} ${l.enhet}  ${l.beskrivelse}  (${nummer})`;
  });

  const hode = [
    `Bestilling ${dok.bestillingsnummer}`,
    dok.kundenummer ? `Kundenummer: ${dok.kundenummer}` : null,
    `Prosjekt ${dok.prosjektnummer} - ${dok.prosjektnavn}`,
    dok.leveringsadresse ? `Leveres til: ${dok.leveringsadresse}` : null,
    dok.onsketLeveringsdato ? `Ønsket levering: ${dok.onsketLeveringsdato}` : null,
    "",
    "Varer:",
  ].filter((l): l is string => l !== null);

  const fot = [
    "",
    dok.merknad ? `Merknad: ${dok.merknad}` : null,
    `Bestilt av ${dok.bestiltAv} via Montørappen.`,
    `Merk leveransen med prosjekt ${dok.prosjektnummer}.`,
  ].filter((l): l is string => l !== null);

  return [...hode, ...linjer, ...fot].join("\n");
}

export function emne(dok: Bestillingsdokument): string {
  const antall = dok.linjer.length;
  return `Bestilling ${dok.bestillingsnummer} - prosjekt ${dok.prosjektnummer} - ${antall} ${
    antall === 1 ? "vare" : "varer"
  }`;
}

/**
 * Lager neste bestillingsnummer.
 *
 * Formen er B-<år>-<løpenummer>, som er kort nok til å leses opp på telefon
 * og entydig nok til å slå opp i etterkant.
 */
export function nesteBestillingsnummer(aar: number, forrigeLopenummer: number): string {
  return `B-${aar}-${String(forrigeLopenummer + 1).padStart(4, "0")}`;
}
