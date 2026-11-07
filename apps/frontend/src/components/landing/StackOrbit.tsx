import type { Brand } from "../../lib/brands";
import { BrandLogo } from "./BrandLogo";

/** The tools TechTalk is built with, on a ring that turns in 3D. Tiles facing away are hidden, so it reads as one ring turning, not a pile. */
export function StackOrbit({ brands }: { brands: Brand[] }) {
  const n = brands.length;
  const radius = 330;
  return (
    <div className="relative h-[210px] sm:h-[240px] [perspective:1100px] overflow-hidden" aria-hidden>
      <div className="absolute inset-0 [transform-style:preserve-3d]" style={{ transform: "rotateX(-8deg)" }}>
        <div className="lp-orbit absolute left-1/2 top-1/2 [transform-style:preserve-3d] w-0 h-0">
          {brands.map((brand, i) => (
            <div
              key={brand.name}
              className="absolute -left-[78px] -top-[34px] w-[156px] h-[68px] rounded-2xl border border-border bg-card/95 shadow-lg flex items-center justify-center [backface-visibility:hidden]"
              style={{ transform: `rotateY(${(360 / n) * i}deg) translateZ(${radius}px)` }}
            >
              <BrandLogo brand={brand} size={22} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
