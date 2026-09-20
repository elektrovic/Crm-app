import { Fanerad } from "./fanerad";
import { Sidetittel } from "@/components/ui";

/**
 * CRM-en med de fem underfanene fra prototypen. Fanene ligger i layouten
 * så de ikke rerendres når man bytter mellom dem.
 */
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidetittel
        tittel="CRM"
        under="Oppfølging, henvendelser, kunder, reklamasjoner og garanti"
      />
      <Fanerad />
      {children}
    </>
  );
}
