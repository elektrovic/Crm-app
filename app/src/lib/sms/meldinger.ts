/**
 * Meldingene som sendes til kunde før og etter et oppdrag.
 *
 * Teksten er bevisst kort og konkret. Kunden skal vite hvem som kommer,
 * omtrent når, og hvem de kan ringe — ikke lese en markedsføringstekst.
 *
 * En SMS er 160 tegn før den splittes i to og koster dobbelt, så vi
 * beregner lengden og advarer i grensesnittet før montøren sender.
 *
 * Ren modul uten I/O.
 */
import type { SmsAnledning } from "@/db/schema";

export type MeldingsInput = {
  kundenavn: string | null;
  prosjektnummer: string;
  montornavn: string;
  firmanavn: string;
  /** «08:00–12:00», hvis jobben har et tidsvindu. */
  tidsvindu?: string | null;
  /** Nummeret kunden kan ringe tilbake på. */
  kontakttelefon?: string | null;
};

/** Fornavnet alene — «Hei Bjørn» leser bedre enn «Hei Bjørn Sæther». */
function fornavn(navn: string): string {
  return navn.trim().split(/\s+/)[0] ?? navn;
}

/**
 * Bytter typografiske tegn mot GSM-trygge.
 *
 * En tankestrek i «08:00–12:00» ser riktig ut på skjermen, men finnes ikke i
 * GSM-alfabetet. Ett slikt tegn tvinger hele meldingen over på UCS-2, der
 * grensen faller fra 160 til 70 tegn — og en melding som skulle kostet én
 * SMS koster plutselig to. Gange antall kunder blir det penger.
 */
function gsmTrygg(tekst: string): string {
  return tekst
    .replace(/[\u2010-\u2015]/g, "-") // bindestrek- og tankestrekvarianter
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ");
}

export function lagMelding(anledning: SmsAnledning, input: MeldingsInput): string {
  const hilsen = input.kundenavn ? `Hei ${fornavn(input.kundenavn)}! ` : "Hei! ";
  const ringbar = input.kontakttelefon ? ` Spørsmål? Ring ${input.kontakttelefon}.` : "";

  if (anledning === "for_oppdrag") {
    const naar = input.tidsvindu ? ` mellom ${input.tidsvindu}` : " i dag";
    return gsmTrygg(
      `${hilsen}${fornavn(input.montornavn)} fra ${input.firmanavn} kommer${naar} ` +
        `for å utføre arbeid hos deg.${ringbar}`,
    ).trim();
  }

  return gsmTrygg(
    `${hilsen}Arbeidet hos deg er nå utført av ${fornavn(input.montornavn)} fra ` +
      `${input.firmanavn}. Dokumentasjonen ligger på oppdrag ${input.prosjektnummer}.${ringbar}`,
  ).trim();
}

/**
 * Hvor mange SMS-er teksten faktisk blir.
 *
 * Norske tegn som æ, ø og å finnes i GSM-alfabetet, men tegn som ikke gjør
 * det (typisk emoji eller «—») tvinger meldingen over på UCS-2, der grensen
 * faller fra 160 til 70 tegn. Det er verdt å vite før man sender til 200
 * kunder.
 */
const GSM_TEGN =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
/** Disse koster to tegn hver i GSM-alfabetet. */
const GSM_UTVIDET = "^{}\\[~]|€";

export type Meldingslengde = {
  tegn: number;
  antallSms: number;
  /** Sant når meldingen må sendes som UCS-2, med 70 tegn per melding. */
  krevetUnicode: boolean;
};

export function malMelding(melding: string): Meldingslengde {
  let krevetUnicode = false;
  let vekt = 0;

  for (const tegn of melding) {
    if (GSM_UTVIDET.includes(tegn)) {
      vekt += 2;
    } else if (GSM_TEGN.includes(tegn)) {
      vekt += 1;
    } else {
      krevetUnicode = true;
      vekt += 1;
    }
  }

  if (krevetUnicode) {
    const tegn = [...melding].length;
    return {
      tegn,
      antallSms: tegn === 0 ? 0 : tegn <= 70 ? 1 : Math.ceil(tegn / 67),
      krevetUnicode: true,
    };
  }

  return {
    tegn: vekt,
    // Deles meldingen opp, går sju tegn per del bort til skjøten.
    antallSms: vekt === 0 ? 0 : vekt <= 160 ? 1 : Math.ceil(vekt / 153),
    krevetUnicode: false,
  };
}
