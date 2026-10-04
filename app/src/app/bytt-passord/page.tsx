import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Etikett } from "@/components/ui";
import { MINSTE_LENGDE } from "@/lib/passord";
import { Byttskjema } from "./byttskjema";

export const metadata = { title: "Bytt passord · Montørappen" };

/**
 * Passordbytte.
 *
 * Ligger utenfor både montørappen og ledelsesflaten, med vilje: hit
 * sendes man før man har fått gjøre noe annet, og da skal det ikke stå en
 * meny rundt som frister til å gå et annet sted.
 */
export default async function ByttPassord() {
  const okt = await auth();
  if (!okt?.user?.id) redirect("/logg-inn");

  const maa = okt.user.maaByttePassord;

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 18,
        maxWidth: 420,
        margin: "0 auto",
        padding: "32px 20px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <Etikett>{okt.user.navn}</Etikett>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-.025em" }}>
          {maa ? "Velg ditt eget passord" : "Bytt passord"}
        </h1>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--dempet)", lineHeight: 1.6 }}>
          {maa
            ? "Passordet du fikk er midlertidig. Velg et du husker selv — da er det ingen lapp som ligger igjen i bilen."
            : `Minst ${MINSTE_LENGDE} tegn. Lengde teller mer enn store bokstaver og tegn.`}
        </p>
      </div>

      <Byttskjema maa={maa} />
    </main>
  );
}
