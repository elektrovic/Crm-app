"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IkonFlis } from "@/components/ui";
import type { Rolle } from "@/db/schema";

/**
 * Den mørke sidemenyen fra prototypen, med blå avrundet pille som aktiv
 * markør. På smal skjerm legger den seg som en topplinje i stedet, slik at
 * flaten også kan brukes fra telefon når lederen er ute.
 */
const PUNKTER = [
  { sti: "/admin", navn: "Dashboard", eksakt: true },
  { sti: "/admin/crm", navn: "CRM" },
  { sti: "/admin/henvendelser", navn: "Henvendelser" },
  { sti: "/admin/bemanning", navn: "Bemanning" },
];

export function Sidemeny({
  navn,
  rolle,
  initialer,
}: {
  navn: string;
  rolle: Rolle;
  initialer: string;
}) {
  const sti = usePathname();
  const [apen, setApen] = useState(false);

  function erAktiv(punkt: (typeof PUNKTER)[number]) {
    return punkt.eksakt ? sti === punkt.sti : sti.startsWith(punkt.sti);
  }

  return (
    <>
      <style>{`
        .sidemeny { width: 232px; flex: none; }
        .sidemeny-lenker { flex-direction: column; }
        @media (max-width: 860px) {
          .sidemeny { width: 100%; position: sticky; top: 0; z-index: 30; }
          .sidemeny-innhold { flex-direction: row; align-items: center; gap: 14px; }
          .sidemeny-lenker { flex-direction: row; overflow-x: auto; }
          .sidemeny-bunn { display: none; }
        }
      `}</style>

      <aside
        className="sidemeny"
        style={{
          background: "var(--mork)",
          display: "flex",
          flexDirection: "column",
          padding: "22px 16px",
        }}
      >
        <div
          className="sidemeny-innhold"
          style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px" }}>
            <IkonFlis farge="var(--bla)" storrelse={30}>
              M
            </IkonFlis>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-.01em" }}>
                Montørappen
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9.5,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: "var(--mork-dempet)",
                }}
              >
                Halland Gruppen
              </div>
            </div>
          </div>

          <nav
            className="sidemeny-lenker sc"
            aria-label="Adminmeny"
            style={{ display: "flex", gap: 4 }}
          >
            {PUNKTER.map((p) => {
              const aktiv = erAktiv(p);
              return (
                <Link
                  key={p.sti}
                  href={p.sti}
                  aria-current={aktiv ? "page" : undefined}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    background: aktiv ? "var(--bla)" : "transparent",
                    color: aktiv ? "#fff" : "var(--mork-dempet)",
                    fontSize: 13.5,
                    fontWeight: aktiv ? 700 : 600,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    transition: "background .15s ease",
                  }}
                >
                  {p.navn}
                </Link>
              );
            })}
          </nav>
        </div>

        <div
          className="sidemeny-bunn"
          style={{ borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 14 }}
        >
          <button
            onClick={() => setApen((a) => !a)}
            aria-expanded={apen}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              background: "none",
              border: "none",
              padding: "4px 6px",
              textAlign: "left",
            }}
          >
            <IkonFlis farge="var(--bla)" storrelse={28}>
              {initialer}
            </IkonFlis>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#fff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {navn}
              </span>
              <span
                style={{ display: "block", fontSize: 11, color: "var(--mork-dempet)" }}
              >
                {rolle === "admin" ? "Administrator" : "Leder"}
              </span>
            </span>
          </button>

          {apen && (
            <Link
              href="/hjem"
              style={{
                display: "block",
                marginTop: 8,
                padding: "8px 10px",
                borderRadius: 9,
                background: "rgba(255,255,255,.07)",
                color: "#fff",
                fontSize: 12.5,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Til montørappen
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
