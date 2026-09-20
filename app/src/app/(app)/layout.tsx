import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Bunnmeny } from "@/components/bunnmeny";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const okt = await auth();
  if (!okt?.user?.id) redirect("/logg-inn");

  return (
    <div style={{ minHeight: "100dvh", paddingBottom: "calc(var(--bunnmeny-hoyde) + 16px)" }}>
      <main
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: "22px 16px 0",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {children}
      </main>
      <Bunnmeny />
    </div>
  );
}
