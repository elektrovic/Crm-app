import type { Rolle } from "@/db/schema";

/**
 * Rollenavnene, på norsk.
 *
 * Ligger her og ikke i skjermen som bruker dem. Den første utgaven hadde
 * dem i en «use client»-fil, og da ble de borte: Next gjør alle eksporter
 * fra en klientmodul om til referanser, så et oppslag fra en
 * serverkomponent ga undefined — og tabellen viste tomme merker uten at
 * noe feilet.
 */
export const ROLLENAVN: Record<Rolle, string> = {
  montor: "Montør",
  leder: "Leder",
  admin: "Administrator",
};

/** Hva rollen faktisk gir tilgang til, i én setning. */
export const ROLLEFORKLARING: Record<Rolle, string> = {
  montor: "Ser bare sine egne jobber og timer",
  leder: "Ser og planlegger sin egen avdeling",
  admin: "Ser alle avdelinger, og kan opprette brukere",
};
