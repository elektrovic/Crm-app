"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const FANER = [
  { sti: "/admin/crm", navn: "Oppfølging i dag", eksakt: true },
  { sti: "/admin/crm/pipeline", navn: "Henvendelser" },
  { sti: "/admin/crm/kunder", navn: "Kunder" },
  { sti: "/admin/crm/reklamasjoner", navn: "Reklamasjoner" },
  { sti: "/admin/crm/garanti", navn: "Garanti og gjenkjøp" },
];

export function Fanerad() {
  const sti = usePathname();

  return (
    <div
      className="sc"
      style={{
        display: "flex",
        gap: 6,
        overflowX: "auto",
        borderBottom: "1px solid var(--linje)",
        paddingBottom: 10,
      }}
    >
      {FANER.map((f) => {
        const aktiv = f.eksakt ? sti === f.sti : sti.startsWith(f.sti);
        return (
          <Link
            key={f.sti}
            href={f.sti}
            aria-current={aktiv ? "page" : undefined}
            style={{
              flex: "none",
              padding: "8px 14px",
              borderRadius: 999,
              background: aktiv ? "var(--bla)" : "var(--kort)",
              color: aktiv ? "#fff" : "var(--tekst-2)",
              boxShadow: aktiv ? "none" : "var(--skygge)",
              fontSize: 13,
              fontWeight: aktiv ? 700 : 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {f.navn}
          </Link>
        );
      })}
    </div>
  );
}
