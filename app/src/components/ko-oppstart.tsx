"use client";

import { useEffect } from "react";
import { startKo } from "@/lib/offline/ko";

/**
 * Registrerer service workeren og kobler sendekøen til nettverksstatus.
 * Ligger i rotlayouten slik at køen tømmes uansett hvilken skjerm
 * montøren åpner appen på.
 */
export function KoOppstart() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((feil) => {
        console.warn("Service worker lot seg ikke registrere", feil);
      });
    }
    return startKo();
  }, []);

  return null;
}
