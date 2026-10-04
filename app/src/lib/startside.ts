import type { Rolle } from "@/db/schema";

/**
 * Hvor en innlogget bruker hører hjemme.
 *
 * Ledelsen har sin egen flate — dashboard, CRM, prosjekter, kalender.
 * Montøren har sin. Før dette pekte både rota og innlogginga til «/hjem»
 * uansett rolle, så en leder landet i montørappen og hadde ingen vei
 * videre: hele adminflaten fantes, men ingen lenke gikk dit.
 *
 * Dette er bare veivisning. Sperrene ligger i adminlayouten og i
 * `krevRolle()` på hver eneste skriving, og de står uansett hva denne
 * funksjonen svarer.
 */
export function startside(rolle: Rolle): "/admin" | "/hjem" {
  return rolle === "montor" ? "/hjem" : "/admin";
}
