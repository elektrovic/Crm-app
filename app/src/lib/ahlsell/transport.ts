/**
 * Hvordan en bestilling faktisk forlater huset.
 *
 * Transporten ligger bak et grensesnitt, slik at dokumentet i
 * `bestilling.ts` ikke vet — og ikke trenger å vite — om det går som
 * e-post, EDI eller PunchOut.
 *
 * Status i dag:
 *
 * - `epost` virker. Bestillingen går til innkjøpsadressen som lesbar tekst
 *   med CSV-en vedlagt i meldingen, merket med prosjektnummer.
 * - `ahlsell_edi` er ikke skrevet. Den krever e-handelsavtale med Ahlsell,
 *   og deres EDI-spesifikasjon avgjør hvilke kvalifikatorer og segmenter
 *   ORDERS-meldingen skal ha. Å gjette på det ville gitt en fil de avviser.
 *   Når avtalen er på plass er det denne ene funksjonen som skal skrives —
 *   datamodellen og CSV-en over er allerede riktige.
 */
import "server-only";
import { sendEpost, epostErSattOpp } from "@/lib/epost/graph";
import { emne, tilCsv, tilTekst, type Bestillingsdokument } from "./bestilling";

export class TransportFeil extends Error {
  constructor(
    message: string,
    readonly kanProvesIgjen: boolean,
  ) {
    super(message);
    this.name = "TransportFeil";
  }
}

export type Sendekvittering = {
  vei: string;
  /** Referansen grossisten ga oss, når vi får en. E-post gir ingen. */
  grossistOrdrenummer: string | null;
};

type Transport = {
  navn: string;
  send(dok: Bestillingsdokument): Promise<Sendekvittering>;
};

function epost(): Transport {
  const mottaker = process.env.BESTILLING_MOTTAKER;
  if (!mottaker || !epostErSattOpp()) {
    throw new TransportFeil(
      "E-post er ikke satt opp. Trenger GRAPH_AVSENDER og BESTILLING_MOTTAKER.",
      false,
    );
  }

  return {
    navn: "epost",
    async send(dok) {
      // CSV-en legges i meldingen framfor som vedlegg, slik at den kan
      // kopieres rett inn i grossistens system uten å laste ned noe.
      const kropp = [
        tilTekst(dok),
        "",
        "--- Maskinlesbar utgave (CSV) ---",
        tilCsv(dok).trimEnd(),
      ].join("\n");

      await sendEpost({
        til: mottaker.split(",").map((a) => a.trim()),
        emne: emne(dok),
        tekst: kropp,
      });

      return { vei: "epost", grossistOrdrenummer: null };
    },
  };
}

function ahlsellEdi(): Transport {
  throw new TransportFeil(
    "EDI mot Ahlsell er ikke satt opp ennå. Det krever e-handelsavtale og " +
      "deres EDI-spesifikasjon (ORDERS-oppsett, kvalifikatorer, kundenummer). " +
      "Bruk BESTILLINGSVEI=epost i mellomtiden.",
    false,
  );
}

function velgTransport(): Transport {
  switch (process.env.BESTILLINGSVEI) {
    case "epost":
      return epost();
    case "ahlsell_edi":
      return ahlsellEdi();
    default:
      // E-post er en trygg standard: den virker, og den sender aldri noe
      // uten at adressene er satt opp.
      return epost();
  }
}

/** Sant når en bestilling faktisk kan sendes. Styrer knappen i appen. */
export function bestillingKanSendes(): boolean {
  try {
    velgTransport();
    return true;
  } catch {
    return false;
  }
}

export async function sendBestilling(dok: Bestillingsdokument): Promise<Sendekvittering> {
  return velgTransport().send(dok);
}
