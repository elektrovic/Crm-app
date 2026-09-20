/**
 * Endringslogg.
 *
 * Dette er dokumentasjonen i en tvist om fakturert tid: hvem endret hva, når.
 * Raden skrives én gang og oppdateres aldri.
 *
 * Loggingen skal aldri velte selve handlingen — klarer vi ikke å skrive
 * loggen, skal timeføringen fortsatt gå gjennom. Derfor fanges feilen her.
 */
import "server-only";
import { db } from "@/db";
import { endringslogg } from "@/db/schema";
import type { Okt } from "./tilgang";

export type Endring = {
  handling: string;
  tabell: string;
  radId?: string;
  for?: unknown;
  etter?: unknown;
  ipAdresse?: string;
};

export async function loggEndring(okt: Okt, endring: Endring): Promise<void> {
  try {
    await db.insert(endringslogg).values({
      tenantId: okt.tenantId,
      ansattId: okt.id,
      handling: endring.handling,
      tabell: endring.tabell,
      radId: endring.radId ?? null,
      for: endring.for ?? null,
      etter: endring.etter ?? null,
      ipAdresse: endring.ipAdresse ?? null,
    });
  } catch (feil) {
    console.error("Klarte ikke å skrive endringslogg", {
      handling: endring.handling,
      tabell: endring.tabell,
      feil,
    });
  }
}
