"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { feltstil } from "@/components/crm-handling";
import { Kort } from "@/components/ui";

type Treff = {
  slag: "kunde" | "sak" | "prosjekt";
  id: string;
  tittel: string;
  under: string | null;
  lenke: string;
};

const MERKE: Record<Treff["slag"], string> = {
  kunde: "Kunde",
  sak: "Sak",
  prosjekt: "Prosjekt",
};

/**
 * Ett søk for hele CRM-en.
 *
 * Man husker et navn eller et nummer — ikke hvilken fane det ligger i. Her
 * søkes det i kunder, saker og prosjekter samtidig, og treffene er merket
 * med hva de er.
 *
 * Søket venter 250 ms etter siste tastetrykk og avbryter forrige kall. Uten
 * det sender et navn på ti bokstaver ti spørringer, og svarene kan komme i
 * feil rekkefølge — da blinker lista med treff fra noe du alt har skrevet
 * ferdig.
 */
export function Sokefelt() {
  const [q, setQ] = useState("");
  const [treff, setTreff] = useState<Treff[]>([]);
  const [leter, setLeter] = useState(false);
  const avbryt = useRef<AbortController | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setTreff([]);
      return;
    }

    const timer = setTimeout(async () => {
      avbryt.current?.abort();
      const styring = new AbortController();
      avbryt.current = styring;
      setLeter(true);
      try {
        const svar = await fetch(`/api/crm/sok?q=${encodeURIComponent(q)}`, {
          signal: styring.signal,
        });
        const data = await svar.json();
        setTreff(Array.isArray(data.treff) ? data.treff : []);
      } catch {
        // Avbrutt fordi man tastet videre. Det er ikke en feil.
      } finally {
        setLeter(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div style={{ position: "relative" }}>
      <input
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        placeholder="Søk kunde, sak eller prosjekt — navn, nummer eller telefon"
        aria-label="Søk i CRM"
        style={{ ...feltstil, height: 44 }}
      />

      {q.trim().length >= 2 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 50, zIndex: 40 }}>
          <Kort style={{ padding: 8 }}>
            {treff.length === 0 ? (
              <p style={{ margin: 0, padding: "8px 6px", fontSize: 13, color: "var(--dempet)" }}>
                {leter ? "Leter…" : "Ingen treff."}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {treff.map((t) => (
                  <Link
                    key={`${t.slag}-${t.id}`}
                    href={t.lenke}
                    onClick={() => setQ("")}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 9,
                      padding: "9px 6px",
                      textDecoration: "none",
                      borderRadius: 8,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 9.5,
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                        color: "var(--svak)",
                        minWidth: 58,
                      }}
                    >
                      {MERKE[t.slag]}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "var(--tekst)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.tittel}
                      </span>
                      {t.under && (
                        <span style={{ display: "block", fontSize: 11.5, color: "var(--dempet)" }}>
                          {t.under}
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Kort>
        </div>
      )}
    </div>
  );
}
