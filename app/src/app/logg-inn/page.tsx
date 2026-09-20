import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Etikett, Kort } from "@/components/ui";

export default async function LoggInn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const okt = await auth();
  if (okt?.user?.id) redirect("/hjem");

  const { error } = await searchParams;

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 20,
        maxWidth: 420,
        margin: "0 auto",
        padding: "32px 20px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Etikett>Halland Gruppen</Etikett>
        <h1
          style={{
            margin: 0,
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: "-.03em",
            lineHeight: 1.02,
          }}
        >
          Montørappen
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: "var(--dempet)", lineHeight: 1.6 }}>
          Logg inn med jobbkontoen din. Det er den samme kontoen du bruker på
          e-post, så du trenger ikke et nytt passord.
        </p>
      </div>

      {error && (
        <Kort style={{ background: "var(--rod-bg)", boxShadow: "none" }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--rod-tekst)", fontWeight: 600 }}>
            {error === "AccessDenied"
              ? "Kontoen din er ikke satt opp i Montørappen ennå. Si fra til leder, så legger de deg inn."
              : "Innloggingen gikk ikke gjennom. Prøv en gang til."}
          </p>
        </Kort>
      )}

      <form
        action={async () => {
          "use server";
          await signIn("microsoft-entra-id", { redirectTo: "/hjem" });
        }}
      >
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "15px 18px",
            borderRadius: 13,
            border: "none",
            background: "var(--mork)",
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Logg inn med Microsoft
        </button>
      </form>

      <p style={{ margin: 0, fontSize: 12.5, color: "var(--svak)", lineHeight: 1.55 }}>
        Appen viser bare dine egne jobber. Posisjonsdata fra bilen brukes til
        timeforslag og til å finne nærmeste ledige bil — ikke til å følge med
        på den enkelte.
      </p>
    </main>
  );
}
