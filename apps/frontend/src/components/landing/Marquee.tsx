import type { Brand } from "../../lib/brands";
import { BrandLogo } from "./BrandLogo";

/** A row of logos that drifts sideways, forever: the list is doubled so the loop has no seam. Stops on hover and for people who prefer less motion. */
export function Marquee({ brands, reverse = false, label }: { brands: Brand[]; reverse?: boolean; label: string }) {
  return (
    <div className="lp-marquee-wrap lp-mask overflow-hidden" role="group" aria-label={label}>
      <div className={`flex w-max ${reverse ? "lp-marquee-back" : "lp-marquee"}`}>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex flex-shrink-0 items-center py-3" aria-hidden={copy === 1}>
            {brands.map((brand) => <BrandLogo key={brand.name} brand={brand} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
