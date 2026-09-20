"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Signaturfelt kunden faktisk tegner i.
 *
 * Bruker pointer-hendelser, som dekker både finger, penn og mus i ett sett
 * kall — og setter `touch-action: none` slik at siden ikke scroller mens
 * kunden skriver navnet sitt.
 *
 * Lerretet skaleres etter skjermens pikselforhold. Uten det blir streken
 * uskarp på telefon, og en uskarp signatur er dårligere dokumentasjon.
 */
export function Signatur({
  onEndret,
  hoyde = 180,
}: {
  /** Kalles med PNG som base64 uten prefiks, eller null når feltet er tomt. */
  onEndret: (base64: string | null) => void;
  hoyde?: number;
}) {
  const lerret = useRef<HTMLCanvasElement>(null);
  const tegner = useRef(false);
  const harStrek = useRef(false);
  const [tom, setTom] = useState(true);

  const settOppLerret = useCallback(() => {
    const c = lerret.current;
    if (!c) return;
    const forhold = window.devicePixelRatio || 1;
    const bredde = c.clientWidth;

    c.width = bredde * forhold;
    c.height = hoyde * forhold;

    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(forhold, forhold);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0F172A";
  }, [hoyde]);

  useEffect(() => {
    settOppLerret();
    window.addEventListener("resize", settOppLerret);
    return () => window.removeEventListener("resize", settOppLerret);
  }, [settOppLerret]);

  function punkt(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = lerret.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = lerret.current?.getContext("2d");
    if (!ctx) return;
    lerret.current?.setPointerCapture(e.pointerId);
    tegner.current = true;
    const p = punkt(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function flytt(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!tegner.current) return;
    const ctx = lerret.current?.getContext("2d");
    if (!ctx) return;
    const p = punkt(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!harStrek.current) {
      harStrek.current = true;
      setTom(false);
    }
  }

  function slutt() {
    if (!tegner.current) return;
    tegner.current = false;
    if (harStrek.current) {
      const data = lerret.current?.toDataURL("image/png");
      onEndret(data ? data.split(",")[1] ?? null : null);
    }
  }

  function nullstill() {
    const c = lerret.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    harStrek.current = false;
    setTom(true);
    onEndret(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          position: "relative",
          border: "1px dashed var(--linje)",
          borderRadius: 12,
          background: "var(--kort-2)",
          overflow: "hidden",
        }}
      >
        <canvas
          ref={lerret}
          onPointerDown={start}
          onPointerMove={flytt}
          onPointerUp={slutt}
          onPointerCancel={slutt}
          style={{
            display: "block",
            width: "100%",
            height: hoyde,
            touchAction: "none",
            cursor: "crosshair",
          }}
        />
        {tom && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--svak)",
              fontSize: 13,
              pointerEvents: "none",
            }}
          >
            Kunden signerer her
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={nullstill}
        disabled={tom}
        style={{
          alignSelf: "flex-start",
          background: "none",
          border: "none",
          padding: "2px 0",
          fontSize: 12.5,
          fontWeight: 600,
          color: tom ? "var(--svak)" : "var(--bla)",
          cursor: tom ? "default" : "pointer",
        }}
      >
        Tøm feltet
      </button>
    </div>
  );
}
