import { Kort } from "@/components/ui";

export const metadata = { title: "Uten nett · Montørappen" };

export default function Offline() {
  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "80px 20px" }}>
      <Kort>
        <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>
          Ingen forbindelse
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--dempet)", lineHeight: 1.6 }}>
          Du er uten nett akkurat nå. Det du allerede har ført ligger trygt i
          sendekøen og går av gårde så snart dekningen er tilbake — du trenger
          ikke gjøre noe.
        </p>
      </Kort>
    </main>
  );
}
