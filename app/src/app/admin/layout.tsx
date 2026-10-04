import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidemeny } from "./sidemeny";
import { Hurtighenvendelse } from "./hurtighenvendelse";
import { SynkVedBesok } from "./synk-ved-besok";

/**
 * Admin-flaten.
 *
 * Dette er desktop-flaten prototypen viser med mørk sidemeny. Sperren er
 * ikke bare kosmetisk: en montør som skriver inn /admin i adressefeltet
 * sendes tilbake til hjem, og hver enkelt spørring bak her krever leder
 * eller admin i tillegg.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const okt = await auth();
  if (!okt?.user?.id) redirect("/logg-inn");
  if (okt.user.rolle === "montor") redirect("/hjem");

  return (
    <div
      className="adminflate"
      style={{ display: "flex", minHeight: "100dvh", background: "var(--flate)" }}
    >
      <Sidemeny
        navn={okt.user.navn}
        rolle={okt.user.rolle}
        initialer={okt.user.initialer}
        farge={okt.user.farge}
      />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: "34px 36px 80px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {children}
      </main>

      {/* Fast på alle ledersider: telefonen ringer mens du står i noe annet. */}
      <Hurtighenvendelse />

      {/* Henter fra Tripletex når noen er innom, høyst én gang i timen. */}
      <SynkVedBesok />
    </div>
  );
}
