/**
 * Bildekomprimering i nettleseren.
 *
 * Et bilde rett fra et telefonkamera er gjerne 4–8 MB. Det er for stort å
 * sende over 4G i en kjeller, og altfor stort å lagre for hver eneste jobb.
 * Vi skalerer ned til en fornuftig maksbredde og komprimerer til JPEG før
 * noe forlater telefonen — typisk 150–300 kB, som fortsatt er skarpt nok
 * til å dokumentere et tillegg.
 *
 * Kjører i nettleseren.
 */

export type KomprimertBilde = {
  base64: string;
  mimetype: "image/jpeg";
  bredde: number;
  hoyde: number;
  /** Omtrentlig størrelse i byte, til visning. */
  storrelse: number;
};

export async function komprimerBilde(
  fil: File,
  { maksSide = 1600, kvalitet = 0.72 } = {},
): Promise<KomprimertBilde> {
  const bitmap = await lesSomBitmap(fil);

  const skala = Math.min(1, maksSide / Math.max(bitmap.width, bitmap.height));
  const bredde = Math.round(bitmap.width * skala);
  const hoyde = Math.round(bitmap.height * skala);

  const lerret = document.createElement("canvas");
  lerret.width = bredde;
  lerret.height = hoyde;

  const ctx = lerret.getContext("2d");
  if (!ctx) throw new Error("Fikk ikke tegnet bildet i nettleseren.");
  ctx.drawImage(bitmap, 0, 0, bredde, hoyde);
  if ("close" in bitmap) bitmap.close();

  const dataUrl = lerret.toDataURL("image/jpeg", kvalitet);
  const base64 = dataUrl.split(",")[1] ?? "";

  return {
    base64,
    mimetype: "image/jpeg",
    bredde,
    hoyde,
    storrelse: Math.floor((base64.length * 3) / 4),
  };
}

/**
 * createImageBitmap håndterer EXIF-rotasjon riktig i moderne nettlesere,
 * så bilder tatt i portrett ikke havner på siden.
 */
async function lesSomBitmap(fil: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(fil, { imageOrientation: "from-image" });
    } catch {
      // Faller gjennom til <img> under.
    }
  }

  const url = URL.createObjectURL(fil);
  try {
    return await new Promise<HTMLImageElement>((løs, avvis) => {
      const bilde = new Image();
      bilde.onload = () => løs(bilde);
      bilde.onerror = () => avvis(new Error("Klarte ikke å lese bildet."));
      bilde.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** «240 kB» — til å vise hvor mye som faktisk sendes. */
export function visStorrelse(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} kB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}
