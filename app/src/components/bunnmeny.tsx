"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { antallIKo, lyttPaKo } from "@/lib/offline/ko";

/**
 * Mørk bunnmeny med blå pille som aktiv markør — den mobile oversettelsen
 * av sidemenyen i prototypen. Køen viser antall linjer som venter, slik at
 * montøren ser at noe ikke er sendt uten å måtte lete etter det.
 */
const PUNKTER = [
  { sti: "/hjem", navn: "Hjem", ikon: "H" },
  { sti: "/timer", navn: "Timer", ikon: "T" },
  { sti: "/biler", navn: "Biler", ikon: "B" },
  { sti: "/ko", navn: "Kø", ikon: "K" },
];

export function Bunnmeny() {
  const sti = usePathname();
  const [iKo, setIKo] = useState(0);

  useEffect(() => {
    const oppdater = () => void antallIKo().then(setIKo);
    oppdater();
    return lyttPaKo(oppdater);
  }, []);

  return (
    <nav
      aria-label="Hovedmeny"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        background: "var(--mork)",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "8px 10px calc(8px + env(safe-area-inset-bottom))",
        zIndex: 40,
      }}
    >
      {PUNKTER.map((p) => {
        const aktiv = sti.startsWith(p.sti);
        return (
          <Link
            key={p.sti}
            href={p.sti}
            aria-current={aktiv ? "page" : undefined}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "6px 16px",
              borderRadius: 999,
              background: aktiv ? "var(--bla)" : "transparent",
              color: aktiv ? "#fff" : "var(--mork-dempet)",
              textDecoration: "none",
              minWidth: 64,
              position: "relative",
              transition: "background .15s ease",
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }} aria-hidden="true">
              {p.ikon}
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 600 }}>{p.navn}</span>

            {p.sti === "/ko" && iKo > 0 && (
              <span
                aria-label={`${iKo} venter på sending`}
                style={{
                  position: "absolute",
                  top: 2,
                  right: 10,
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  borderRadius: 999,
                  background: "var(--oransje)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {iKo}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
