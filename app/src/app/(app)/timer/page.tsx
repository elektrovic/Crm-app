import { krevOkt } from "@/lib/tilgang";
import { hentDagensOppdrag, hentOfteBrukte, iDag } from "@/lib/data/dagen";
import { hentTimeforslag } from "@/lib/data/kjorebok";
import { hentAktiviteter } from "@/lib/tripletex/synk";
import { tidsspenn } from "@/lib/abax/timeforslag";
import { TimerSkjerm, type Rad, type ForslagVisning } from "./timer-skjerm";

export const metadata = { title: "Timer · Montørappen" };

/** Tre dager bakover, i dag, to framover — som datostripen i prototypen. */
function lagDager(idag: string) {
  const dager = [];
  for (let off = -3; off <= 2; off++) {
    const d = new Date(`${idag}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + off);
    const iso = d.toISOString().slice(0, 10);
    dager.push({
      iso,
      off,
      dag: new Intl.DateTimeFormat("nb-NO", { weekday: "short", timeZone: "UTC" }).format(d),
      dato: new Intl.DateTimeFormat("nb-NO", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(d),
    });
  }
  return dager;
}

export default async function Timer({
  searchParams,
}: {
  searchParams: Promise<{ dato?: string }>;
}) {
  const okt = await krevOkt();
  const { dato: valgtRaa } = await searchParams;

  const idag = iDag();
  const dager = lagDager(idag);
  const valgtDato = dager.some((d) => d.iso === valgtRaa) ? valgtRaa! : idag;

  const oppdrag = await hentDagensOppdrag(okt, valgtDato);
  const ofte = await hentOfteBrukte(
    okt,
    oppdrag.map((o) => o.prosjektId),
  );
  const forslag = await hentTimeforslag(okt, valgtDato);
  const aktiviteter = await hentAktiviteter(okt.tenantId, okt.avdeling);

  const rader: Rad[] = [
    ...oppdrag.map((o) => ({
      prosjektId: o.prosjektId,
      nummer: o.nummer,
      navn: o.navn,
      farge: o.farge,
      meta: o.fraKl ? `${o.fraKl}–${o.tilKl}` : "På kalenderen",
      fraKalender: true,
    })),
    ...ofte.map((o) => ({
      prosjektId: o.prosjektId,
      nummer: o.nummer,
      navn: o.navn,
      farge: o.farge,
      meta: "Brukes ofte",
      fraKalender: false,
    })),
  ];

  // Forslagene sendes videre som ferdig formaterte klokkeslett, slik at
  // klienten slipper å regne på tidssoner.
  const forslagVisning: ForslagVisning[] = forslag.map((f) => ({
    prosjektId: f.prosjektId,
    nummer: f.prosjektNummer,
    navn: f.prosjektNavn,
    farge: f.farge ?? "#2563EB",
    timer: f.timer,
    spenn: tidsspenn(f.fra, f.til),
    meterFraProsjekt: f.meterFraProsjekt,
  }));

  return (
    <TimerSkjerm
      dager={dager}
      valgtDato={valgtDato}
      rader={rader}
      forslag={forslagVisning}
      aktiviteter={aktiviteter}
      harAbax={Boolean(okt.abaxVehicleId)}
    />
  );
}
