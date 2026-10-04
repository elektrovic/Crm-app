import type { NextConfig } from "next";
import { sikkerhetsHeadere } from "./src/lib/sikkerhet/csp";

/**
 * Sikkerhetsheaderne settes her, ikke i en proxy foran appen, slik at de
 * følger med uansett hvor appen driftes.
 *
 * Selve reglene står i src/lib/sikkerhet/csp.ts, med tester som passer på
 * at lettelsen `next dev` trenger aldri følger med ut i produksjon.
 */
const utvikling = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: sikkerhetsHeadere(utvikling) }];
  },
};

export default nextConfig;
