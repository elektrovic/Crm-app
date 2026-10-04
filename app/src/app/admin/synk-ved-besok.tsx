"use client";

import { useEffect } from "react";

/**
 * Synken utløses av at noen åpner portalen.
 *
 * Netlifys planlegger kaller aldri appen — synkloggen står tom time etter
 * time, og den loggen skrives før jobben starter, så fraværet er beviset.
 * I stedet for å feilsøke en planlegger vi ikke ser inn i, kobles synken
 * til noe vi vet skjer: at noen logger inn.
 *
 * Avveiningen er ærlig nok: åpner ingen portalen på en uke, synkes
 * ingenting på en uke. Men da er det heller ingen som venter på tallene.
 *
 * Sperren som faktisk gjelder ligger på serveren — én synk i timen, og
 * ingen ny hvis en annen er i gang. Nøkkelen i nettleseren er bare for å
 * slippe å spørre på hver eneste sidevisning.
 */
const NOKKEL = "sistSynkForsok";
const TIME = 60 * 60 * 1000;

export function SynkVedBesok() {
  useEffect(() => {
    let avbrutt = false;

    try {
      const sist = Number(window.localStorage.getItem(NOKKEL) ?? 0);
      if (Date.now() - sist < TIME) return;
      window.localStorage.setItem(NOKKEL, String(Date.now()));
    } catch {
      // Privat vindu eller sperret lagring. Da spør vi serveren hver gang —
      // den sier nei selv, og det koster ett oppslag.
    }

    // Ingen venting, ingen feilmelding til brukeren. Dette skjer i
    // bakgrunnen, og går det galt står det i synkloggen under Prosjekter.
    void fetch("/api/synk?hvisForfalt=1", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (!avbrutt && d && !d.hoppet) {
          console.info("Synk mot Tripletex kjørt ved innlogging.", d);
        }
      })
      .catch(() => {});

    return () => {
      avbrutt = true;
    };
  }, []);

  return null;
}
