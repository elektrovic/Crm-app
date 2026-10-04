/**
 * Innholdssikkerhetsreglene (Content-Security-Policy).
 *
 * De er strammet til det Montørappen faktisk trenger: appen laster ingen
 * tredjeparts skript, og skal aldri kunne rammes inn av et annet nettsted.
 *
 * Ett unntak finnes, og bare under utvikling. React i utviklingsmodus
 * bruker `eval()` for å bygge opp callstacker på tvers av server og
 * klient, og Turbopack holder en websocket åpen for å bytte ut kode mens
 * sida står. Begge deler stoppes av reglene under, og da får man en hvit
 * side med «eval() is not supported in this environment» i stedet for en
 * app.
 *
 * Unntaket henger på `utvikling`, ikke på en miljøvariabel noen kan sette
 * feil. React bruker aldri `eval()` i produksjonsmodus, så det er ingen
 * grunn til å slippe det gjennom der — og testene ved siden av passer på
 * at det ikke skjer.
 */

export function byggCsp(utvikling: boolean): string {
  const skript = ["'self'", "'unsafe-inline'"];
  const tilkobling = ["'self'"];

  if (utvikling) {
    skript.push("'unsafe-eval'");
    // Turbopack bytter ut kode over websocket mens sida står.
    tilkobling.push("ws://localhost:*", "http://localhost:*");
  }

  return [
    "default-src 'self'",
    `script-src ${skript.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src ${tilkobling.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function sikkerhetsHeadere(utvikling: boolean) {
  return [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: "Content-Security-Policy", value: byggCsp(utvikling) },
  ];
}
