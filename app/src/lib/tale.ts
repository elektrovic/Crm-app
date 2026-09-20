/**
 * Taledgjenkjenning i nettleseren.
 *
 * Web Speech API er ikke med i TypeScripts DOM-typer, og heter fortsatt
 * `webkitSpeechRecognition` i Safari og Chrome. Her ligger både typene og
 * oppslaget ett sted, så komponentene slipper å drive med det.
 *
 * Støtten varierer mellom nettlesere. Finnes den ikke, faller vi tilbake på
 * tastaturet — som uansett har diktering på både iOS og Android, så
 * montøren kan snakke inn linja der i stedet.
 *
 * Kjører i nettleseren.
 */

export type TaleResultat = { tekst: string };

export type TaleLytter = {
  start(): void;
  avbryt(): void;
};

type RaaGjenkjenner = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type RaaKonstruktor = new () => RaaGjenkjenner;

function finnKonstruktor(): RaaKonstruktor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RaaKonstruktor;
    webkitSpeechRecognition?: RaaKonstruktor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Sant når nettleseren kan ta diktering. Brukes til å skjule mikrofonknappen. */
export function taleStottes(): boolean {
  return finnKonstruktor() !== null;
}

/**
 * Lytter etter én ytring og kaller `onTekst` med det som ble sagt.
 * Returnerer null når nettleseren ikke støtter det.
 */
export function lyttEtterTale(handlinger: {
  onTekst: (tekst: string) => void;
  onFeil: () => void;
  onSlutt: () => void;
  sprak?: string;
}): TaleLytter | null {
  const Konstruktor = finnKonstruktor();
  if (!Konstruktor) return null;

  const g = new Konstruktor();
  g.lang = handlinger.sprak ?? "nb-NO";
  g.interimResults = false;
  g.maxAlternatives = 1;

  g.onresult = (e) => {
    const tekst = e.results[0]?.[0]?.transcript ?? "";
    if (tekst) handlinger.onTekst(tekst);
  };
  g.onerror = handlinger.onFeil;
  g.onend = handlinger.onSlutt;

  return {
    start: () => g.start(),
    avbryt: () => g.abort(),
  };
}
