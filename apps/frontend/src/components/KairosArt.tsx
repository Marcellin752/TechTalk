/* Kairos, drawn: the Greek god of the right moment, shown bald but for a single
   lock of hair, because "you must seize opportunity by the forelock". The artwork
   is an original illustration in /public/kairos.svg. It replaces the generic AI
   sparkle everywhere Kairos appears. */

/** The whole portrait, for backgrounds and hero spots. Decorative: hidden from screen readers. */
export function KairosPortrait({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <img src="/kairos.svg" alt="" aria-hidden draggable={false} className={`select-none pointer-events-none ${className}`} style={style} />;
}

/** Just the face, cropped round: Kairos' avatar in chat bubbles, headers, the menu and the floating button. */
export function KairosFace({ size = 28, ring = true }: { size?: number; ring?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex-shrink-0 rounded-full overflow-hidden ${ring ? "ring-1 ring-primary/30" : ""} shadow-md shadow-primary/25`}
      style={{
        width: size,
        height: size,
        backgroundColor: "#fff1e3",
        backgroundImage: "url(/kairos.svg)",
        backgroundSize: "210%",
        backgroundPosition: "50% 30%",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

/** Drop-in for an icon slot (same props as a lucide icon): Kairos' face instead of the AI sparkle. */
export function KairosIcon({ size = 20 }: { size?: number; strokeWidth?: number; className?: string }) {
  return <KairosFace size={size + 2} ring={false} />;
}
