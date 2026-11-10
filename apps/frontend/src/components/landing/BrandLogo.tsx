import type { Brand } from "../../lib/brands";

/** A logo that is quiet until hovered: grey in the page's own text colour, in its brand colour on hover. */
export function BrandLogo({ brand, size = 26 }: { brand: Brand; size?: number }) {
  return (
    <span className="group inline-flex items-center gap-2.5 px-5 text-muted-foreground transition-colors hover:text-[var(--brand)]" style={{ ["--brand" as string]: brand.hex }} title={brand.name}>
      {brand.path ? (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={brand.name} className="flex-shrink-0 opacity-80 group-hover:opacity-100">
          <path d={brand.path} />
        </svg>
      ) : null}
      <span className="text-[15px] font-semibold tracking-tight whitespace-nowrap">{brand.name}</span>
    </span>
  );
}
