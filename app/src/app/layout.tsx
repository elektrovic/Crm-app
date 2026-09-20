import type { Metadata, Viewport } from "next";
import "./globals.css";
import { KoOppstart } from "@/components/ko-oppstart";

export const metadata: Metadata = {
  title: "Montørappen",
  description: "Timeføring, prosjekter og bilkart for Halland Gruppen",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Montør",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#131C31",
  width: "device-width",
  initialScale: 1,
  // Montører bruker hansker. Zoom skal være lov.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <KoOppstart />
        {children}
      </body>
    </html>
  );
}
