/**
 * Typer for ABAX-data.
 *
 * Ligger i egen modul, ikke i client.ts, slik at ren logikk (og testene)
 * kan bruke dem uten å dra inn en server-only klient.
 */

export type AbaxKjoretoy = {
  id: string;
  alias?: string;
  license_plate?: string;
  location?: {
    latitude: number;
    longitude: number;
    timestamp?: string;
    signal_source?: string;
  };
};

export type AbaxTur = {
  id: string;
  vehicle_id?: string;
  /** ISO-tidspunkt for start og slutt på turen. */
  from?: { timestamp: string; latitude?: number; longitude?: number };
  to?: { timestamp: string; latitude?: number; longitude?: number };
  distance?: number;
};
