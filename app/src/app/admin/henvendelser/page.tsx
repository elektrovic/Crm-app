import { redirect } from "next/navigation";

/**
 * Henvendelser bodde to steder: her, med AI-triage, og som fane i CRM-en.
 * To lister over det samme er én liste for mye — man rekker å glemme en
 * sak i den man ikke åpnet. Alt ligger nå under CRM.
 *
 * Sida blir stående og peker videre, så gamle bokmerker og lenker i
 * e-poster fortsatt virker.
 */
export default function GammelHenvendelsesside() {
  redirect("/admin/crm/pipeline");
}
