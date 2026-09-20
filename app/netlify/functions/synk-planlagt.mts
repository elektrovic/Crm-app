/**
 * Planlagt synk mot Tripletex.
 *
 * Netlify kjører planlagte funksjoner med en grense på 30 sekunder, og
 * vanlige funksjoner på 26. Derfor gjør ikke denne funksjonen jobben selv —
 * den kaller appens eget synk-endepunkt, som er bygget for å holde seg
 * innenfor budsjettet og ta resten ved neste kjøring.
 *
 * Det som ikke rekkes på én time, står igjen og tas den neste. Synken er
 * laget for å kunne kjøres om igjen uten å gjøre skade: den speiler,
 * den sletter aldri, og hver adresse merkes så den ikke slås opp to ganger.
 */
import type { Config } from "@netlify/functions";

export default async function synk(): Promise<Response> {
  const nokkel = process.env.SYNK_NOKKEL;
  // Netlify setter URL til nettstedets adresse i produksjon.
  const base = process.env.URL;

  if (!nokkel || !base) {
    console.error("Synk hoppet over: SYNK_NOKKEL eller URL mangler i miljøet.");
    // 200 med vilje — en feilkode her ville bare gitt Netlify grunn til å
    // prøve igjen på et oppsett som fortsatt er ufullstendig.
    return new Response("Ikke satt opp", { status: 200 });
  }

  const start = Date.now();

  try {
    const svar = await fetch(`${base}/api/synk`, {
      method: "POST",
      headers: { Authorization: `Bearer ${nokkel}` },
    });

    const kropp = await svar.text();
    const brukt = Date.now() - start;

    if (!svar.ok) {
      console.error(`Synk feilet (${svar.status}) etter ${brukt} ms: ${kropp.slice(0, 500)}`);
      return new Response("Synk feilet", { status: 500 });
    }

    console.log(`Synk ferdig på ${brukt} ms: ${kropp.slice(0, 500)}`);
    return new Response("Ferdig", { status: 200 });
  } catch (feil) {
    console.error("Synk nådde ikke fram", feil);
    return new Response("Ingen forbindelse", { status: 500 });
  }
}

export const config: Config = {
  // Hver time, på hel time. Cron tolkes i UTC hos Netlify, men denne
  // kjører like ofte hele døgnet, så sommertid spiller ingen rolle.
  schedule: "0 * * * *",
};
