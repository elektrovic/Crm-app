import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";
import { Etikett, Kort } from "@/components/ui";
import { db } from "@/db";
import { ansatte } from "@/db/schema";
import { DEMO_INNLOGGING, DEMO_KLAR } from "@/lib/demo";
import { startside } from "@/lib/startside";
import { eq } from "drizzle-orm";

/** Microsoft-innlogging er valgfri. Halland bruker den ikke. */
const ENTRA_SATT_OPP = Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim());

const feltstil = {
  height: 46,
  padding: "0 13px",
  borderRadius: 11,
  border: "1px solid var(--linje)",
  background: "var(--kort)",
  color: "var(--tekst)",
  fontSize: 15,
  width: "100%",
} as const;

export default async function LoggInn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; byttet?: string }>;
}) {
  const okt = await auth();
  if (okt?.user) redirect(startside(okt.user.rolle));

  const { error, byttet } = await searchParams;

  // I demomodus lister vi opp de ansatte som finnes, så man kan gå inn og
  // se appen uten Entra-oppsettet. Tom liste utenfor demomodus.
  const demobrukere = DEMO_KLAR
    ? await db.query.ansatte.findMany({
        where: eq(ansatte.aktiv, true),
        columns: {
          epost: true,
          navn: true,
          rolle: true,
          initialer: true,
          farge: true,
        },
      })
    : [];

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
        <p
          style={{
            margin: 0,
            fontSize: 15,
            color: "var(--dempet)",
            lineHeight: 1.6,
          }}
        >
          Logg inn med e-postadressen din og passordet du har fått. Har du
          ikke fått et, si fra til kontoret.
        </p>
      </div>

      {byttet === "1" && (
        <Kort style={{ background: "var(--gronn-bg, var(--flate))", boxShadow: "none" }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--tekst)" }}>
            Passordet er byttet. Logg inn med det nye.
          </p>
        </Kort>
      )}

      {error && (
        <Kort style={{ background: "var(--rod-bg)", boxShadow: "none" }}>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              color: "var(--rod-tekst)",
              fontWeight: 600,
            }}
          >
            {error === "AccessDenied"
              ? "Kontoen din er ikke satt opp i Montørappen ennå. Si fra til kontoret, så legger de deg inn."
              : error === "CredentialsSignin"
                ? "E-posten eller passordet stemmer ikke."
                : "Innloggingen gikk ikke gjennom. Prøv en gang til."}
          </p>
        </Kort>
      )}

      <form
        action={async (skjema: FormData) => {
          "use server";
          // Auth.js kaster når innloggingen ikke går gjennom. Tas den ikke
          // imot her, bobler den opp som en serverfeil og brukeren får en
          // krasjside i stedet for «passordet stemmer ikke».
          //
          // Den vellykkede veien kaster også — en omdirigering — og den
          // skal gå videre urørt. Derfor sjekkes typen i stedet for å
          // svelge alt.
          try {
            await signIn("passord", {
              epost: String(skjema.get("epost") ?? ""),
              passord: String(skjema.get("passord") ?? ""),
              redirectTo: "/",
            });
          } catch (feil) {
            if (feil instanceof AuthError) {
              redirect(`/logg-inn?error=${feil.type}`);
            }
            throw feil;
          }
        }}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <Etikett>E-post</Etikett>
          <input
            type="email"
            name="epost"
            required
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="fornavn@hallandgruppen.no"
            style={feltstil}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <Etikett>Passord</Etikett>
          <input
            type="password"
            name="passord"
            required
            autoComplete="current-password"
            style={feltstil}
          />
        </label>

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
          Logg inn
        </button>
      </form>

      {/* Microsoft-knappen vises bare når Entra faktisk er satt opp. En
          knapp som alltid feiler er verre enn ingen knapp. */}
      {ENTRA_SATT_OPP && (
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "13px 18px",
              borderRadius: 13,
              border: "1px solid var(--linje)",
              background: "var(--kort)",
              color: "var(--tekst)",
              fontSize: 14.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Logg inn med Microsoft
          </button>
        </form>
      )}

      {DEMO_INNLOGGING && (
        <Kort style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Etikett>Demomodus</Etikett>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--dempet)",
                lineHeight: 1.55,
              }}
            >
              Entra ID er ikke satt opp ennå, så systemet vises fram med et
              felles passord. Skriv passordet, og velg hvem du vil se appen som.
              Skrus av med <code>DEMO_INNLOGGING</code> før ekte data legges
              inn.
            </p>
          </div>

          <form
            action={async (skjema: FormData) => {
              "use server";
              // Ett felles passord, og hvem du er som egen knapp. Knappens
              // name/value følger med i skjemaet, så begge deler kommer inn
              // i samme innsending.
              await signIn("demo", {
                epost: String(skjema.get("epost") ?? ""),
                passord: String(skjema.get("passord") ?? ""),
                redirectTo: "/",
              });
            }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <Etikett>Demopassord</Etikett>
              <input
                type="password"
                name="passord"
                required
                autoComplete="current-password"
                placeholder="Passordet du har fått"
                style={{
                  height: 42,
                  padding: "0 12px",
                  borderRadius: 11,
                  border: "1px solid var(--linje)",
                  background: "var(--kort)",
                  color: "var(--tekst)",
                  fontSize: 15,
                  width: "100%",
                }}
              />
            </label>

            {demobrukere.map((b) => (
              <button
                key={b.epost}
                type="submit"
                name="epost"
                value={b.epost}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 13px",
                  borderRadius: 12,
                  border: "1px solid var(--linje)",
                  background: "var(--kort)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: "50%",
                    background: b.farge,
                    color: "#fff",
                    fontSize: 12.5,
                    fontWeight: 700,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {b.initialer}
                </span>
                <span
                  style={{ display: "flex", flexDirection: "column", gap: 1 }}
                >
                  <span style={{ fontSize: 14.5, fontWeight: 700 }}>
                    {b.navn}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--dempet)" }}>
                    {b.rolle === "montor" ? "Montør" : "Ledelse"}
                  </span>
                </span>
              </button>
            ))}
          </form>
        </Kort>
      )}

      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          color: "var(--svak)",
          lineHeight: 1.55,
        }}
      >
        Appen viser bare dine egne jobber. Posisjonsdata fra bilen brukes til
        timeforslag og til å finne nærmeste ledige bil — ikke til å følge med på
        den enkelte.
      </p>
    </main>
  );
}
