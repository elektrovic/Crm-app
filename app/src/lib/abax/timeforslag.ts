/**
 * Timeforslag fra ABAX-kjørebok.
 *
 * Ideen er enkel: står bilen stille et sted i arbeidstiden, jobbet montøren
 * sannsynligvis der. Vi finner hvert stopp mellom to turer, matcher posisjonen
 * mot nærmeste prosjekt, og foreslår timer montøren bekrefter — i stedet for
 * at han skal huske klokkeslettene på slutten av dagen.
 *
 * Forslaget er alltid et forslag. Ingenting føres uten at et menneske
 * trykker «Bruk». Det er både et personverntiltak og en forutsetning for at
 * timelista er montørens egen.
 *
 * Ren funksjon uten I/O, slik at logikken kan testes uten å ringe ABAX.
 */
import { avstandMeter } from "./geo";
import type { AbaxTur } from "./typer";

export type ProsjektPunkt = {
  id: string;
  nummer: string;
  navn: string;
  lat: number;
  lon: number;
  farge?: string;
};

export type Stopp = {
  fra: Date;
  til: Date;
  lat: number;
  lon: number;
  minutter: number;
};

export type Timeforslag = {
  prosjektId: string;
  prosjektNummer: string;
  prosjektNavn: string;
  farge?: string;
  /** Klokkeslettene stoppet varte, til visning: «07:34–12:10». */
  fra: Date;
  til: Date;
  /** Avrundede timer, klare til å føres. */
  timer: number;
  /** Hvor langt bilen sto fra prosjektadressen — vises som usikkerhet. */
  meterFraProsjekt: number;
};

export type ForslagsInnstillinger = {
  /** Hvor nær prosjektadressen bilen må stå for at stoppet skal telle. */
  radiusMeter: number;
  /** Stopp kortere enn dette er kaffe og kø, ikke arbeid. */
  minStoppMinutter: number;
  /** Timer avrundes til nærmeste kvarter som standard. */
  avrundingTimer: number;
};

export const STANDARD_INNSTILLINGER: ForslagsInnstillinger = {
  radiusMeter: 250,
  minStoppMinutter: 20,
  avrundingTimer: 0.25,
};

/**
 * Finner periodene bilen sto stille mellom to turer.
 * Posisjonen for stoppet er der forrige tur endte.
 */
export function finnStopp(turer: AbaxTur[], minStoppMinutter: number): Stopp[] {
  const sortert = turer
    .filter((t) => t.from?.timestamp && t.to?.timestamp)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.from!.timestamp).getTime() - new Date(b.from!.timestamp).getTime(),
    );

  const stopp: Stopp[] = [];

  for (let i = 0; i < sortert.length - 1; i++) {
    const denne = sortert[i]!;
    const neste = sortert[i + 1]!;

    const lat = denne.to?.latitude;
    const lon = denne.to?.longitude;
    if (lat === undefined || lon === undefined) continue;

    const fra = new Date(denne.to!.timestamp);
    const til = new Date(neste.from!.timestamp);
    const minutter = (til.getTime() - fra.getTime()) / 60000;

    // Negativ varighet betyr overlappende turer i datagrunnlaget — hopp over.
    if (minutter < minStoppMinutter) continue;

    stopp.push({ fra, til, lat, lon, minutter });
  }

  return stopp;
}

/** Nærmeste prosjekt innenfor radius, eller null hvis bilen sto et annet sted. */
function naermestePunkt(
  stopp: Stopp,
  prosjekter: ProsjektPunkt[],
  radiusMeter: number,
): { prosjekt: ProsjektPunkt; meter: number } | null {
  let beste: { prosjekt: ProsjektPunkt; meter: number } | null = null;

  for (const p of prosjekter) {
    const meter = avstandMeter({ lat: stopp.lat, lon: stopp.lon }, { lat: p.lat, lon: p.lon });
    if (meter > radiusMeter) continue;
    if (!beste || meter < beste.meter) beste = { prosjekt: p, meter };
  }

  return beste;
}

function avrund(timer: number, trinn: number): number {
  return Math.round(timer / trinn) * trinn;
}

/**
 * Gjør en dags kjørebok om til timeforslag per prosjekt.
 *
 * Flere stopp på samme prosjekt slås sammen til én linje, men vi beholder
 * første og siste klokkeslett slik at montøren kjenner igjen dagen sin.
 */
export function lagTimeforslag(
  turer: AbaxTur[],
  prosjekter: ProsjektPunkt[],
  innstillinger: ForslagsInnstillinger = STANDARD_INNSTILLINGER,
): Timeforslag[] {
  const stopp = finnStopp(turer, innstillinger.minStoppMinutter);
  const perProsjekt = new Map<string, Timeforslag>();

  for (const s of stopp) {
    const treff = naermestePunkt(s, prosjekter, innstillinger.radiusMeter);
    if (!treff) continue;

    const eksisterende = perProsjekt.get(treff.prosjekt.id);
    const timer = s.minutter / 60;

    if (eksisterende) {
      eksisterende.timer += timer;
      if (s.fra < eksisterende.fra) eksisterende.fra = s.fra;
      if (s.til > eksisterende.til) eksisterende.til = s.til;
      eksisterende.meterFraProsjekt = Math.min(eksisterende.meterFraProsjekt, treff.meter);
    } else {
      perProsjekt.set(treff.prosjekt.id, {
        prosjektId: treff.prosjekt.id,
        prosjektNummer: treff.prosjekt.nummer,
        prosjektNavn: treff.prosjekt.navn,
        farge: treff.prosjekt.farge,
        fra: s.fra,
        til: s.til,
        timer,
        meterFraProsjekt: Math.round(treff.meter),
      });
    }
  }

  return [...perProsjekt.values()]
    .map((f) => ({ ...f, timer: avrund(f.timer, innstillinger.avrundingTimer) }))
    .filter((f) => f.timer > 0)
    .sort((a, b) => a.fra.getTime() - b.fra.getTime());
}

/** «07:34–12:10» — formatet montøren kjenner igjen fra kjøreboka. */
export function tidsspenn(fra: Date, til: Date, tidssone = "Europe/Oslo"): string {
  const f = new Intl.DateTimeFormat("nb-NO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tidssone,
  });
  return `${f.format(fra)}–${f.format(til)}`;
}

/** Summen av alle forslag, til «Bruk alle · 8,5 t». */
export function sumTimer(forslag: Timeforslag[]): number {
  return forslag.reduce((sum, f) => sum + f.timer, 0);
}
