"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

/**
 * Logg ut.
 *
 * Fantes ikke før. Logget man inn som feil person — eller lånte bort
 * telefonen et øyeblikk — var eneste vei ut å skrive
 * /api/auth/signout i adressefeltet, og det er ikke en vei noen finner.
 *
 * Utloggingen er hard, ikke en klientnavigasjon: økten ligger i et
 * signert token og i rutermellomlageret, og en myk navigasjon kunne la
 * den forrige brukerens skjermbilde stå igjen et øyeblikk. Det er greit
 * når man bytter side, og ikke greit når man bytter person.
 */
export function Loggut({ stil, tekst = "Logg ut" }: { stil?: React.CSSProperties; tekst?: string }) {
  const [jobber, settJobber] = useState(false);

  return (
    <button
      type="button"
      disabled={jobber}
      onClick={async () => {
        settJobber(true);
        await signOut({ redirect: false });
        window.location.href = "/logg-inn";
      }}
      style={{
        border: "none",
        background: "none",
        cursor: "pointer",
        font: "inherit",
        ...stil,
      }}
    >
      {jobber ? "Logger ut…" : tekst}
    </button>
  );
}
