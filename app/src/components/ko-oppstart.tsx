"use client";

import { useEffect } from "react";
import { startKo } from "@/lib/offline/ko";

/**
 * Registrerer service workeren og kobler sendekøen til nettverksstatus.
 * Ligger i rotlayouten slik at køen tømmes uansett hvilken skjerm
 * montøren åpner appen på.
 *
 * I utviklingsmodus gjør den det motsatte: den river den ned.
 *
 * Grunnen er at en service worker overlever at du stopper serveren,
 * bytter gren og starter på nytt. Den serverer statiske filer fra cache
 * først, og den lagrer hele svaret — headere og alt. Da kan du pulle en
 * rettelse, starte appen, og fortsatt få den gamle versjonen servert fra
 * forrige gang, med gamle CSP-headere og gamle JS-biter.
 *
 * Det skjedde: en stram CSP uten «unsafe-eval» ble liggende i cachen, og
 * React i utviklingsmodus klaget på eval() lenge etter at headeren var
 * rettet. Det er en feil som ser ut som om rettelsen ikke virket, og det
 * er den verste typen.
 *
 * Offline-støtten er til for montøren i kjelleren. Den som utvikler har
 * dekning.
 */
const UTVIKLING = process.env.NODE_ENV !== "production";

export function KoOppstart() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (UTVIKLING) {
        void ryddVekkServiceWorker();
      } else {
        navigator.serviceWorker.register("/sw.js").catch((feil) => {
          console.warn("Service worker lot seg ikke registrere", feil);
        });
      }
    }
    return startKo();
  }, []);

  return null;
}

/**
 * Fjerner service workeren og alt den har lagret.
 *
 * Må gjøre begge deler. Å avregistrere workeren alene lar cachen stå, og
 * en ny registrering senere ville plukket opp de samme gamle svarene.
 */
async function ryddVekkServiceWorker() {
  try {
    const registreringer = await navigator.serviceWorker.getRegistrations();
    if (registreringer.length === 0) return;

    await Promise.all(registreringer.map((r) => r.unregister()));

    if ("caches" in window) {
      const navn = await caches.keys();
      await Promise.all(navn.map((n) => caches.delete(n)));
    }

    console.info(
      "Service worker og cache fjernet (utviklingsmodus). Last siden på nytt om noe ser gammelt ut.",
    );
  } catch {
    // Klarer vi ikke å rydde, skal ikke appen stoppe av det.
  }
}
