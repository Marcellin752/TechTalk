import { useRef, useState } from "react";
import { CalendarDays, Check, Flame } from "lucide-react";
import { KairosFace } from "../KairosArt";
import { RoadmapMock } from "./RoadmapMock";
import { useReducedMotion } from "../../lib/motion";
import { useI18n } from "../../lib/i18n";

/**
 * Three windows stacked in depth (your path, Kairos, the calendar) that turn a little with the
 * pointer. Pure CSS 3D: no library, and still when the person prefers less motion.
 */
export function HeroScene() {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const [rot, setRot] = useState({ x: 10, y: -18 });

  const move = (e: React.PointerEvent) => {
    if (reduced) return;
    const r = stage.current?.getBoundingClientRect();
    if (!r) return;
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    setRot({ x: 10 - ny * 14, y: -18 + nx * 20 });
  };

  return (
    <div ref={stage} onPointerMove={move} onPointerLeave={() => setRot({ x: 10, y: -18 })} className="relative mx-auto w-full max-w-[560px] h-[400px] sm:h-[440px] [perspective:1500px]" aria-hidden>
      {/* a soft glow under the scene */}
      <div className="lp-glow absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[70%] rounded-full bg-primary/30 blur-[90px]" />
      <div className="absolute inset-0 [transform-style:preserve-3d] transition-transform duration-300 ease-out" style={{ transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)` }}>
        {/* the path window */}
        <div className="absolute left-0 top-6 w-[500px] max-w-none rounded-2xl border border-border bg-card shadow-2xl shadow-black/20 overflow-hidden origin-top-left scale-[.62] sm:scale-[.88]" style={{ transform: "translateZ(0)" }}>
          <div className="flex items-center gap-1.5 px-4 h-9 border-b border-border bg-secondary/60">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" /><span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
            <span className="ml-3 text-[11px] font-mono text-muted-foreground">techtalk · {t("lp.scene.path")}</span>
          </div>
          <div className="p-4 overflow-hidden"><RoadmapMock /></div>
        </div>

        {/* Kairos */}
        <div className="lp-float absolute right-0 bottom-2 sm:bottom-0 w-[250px] rounded-2xl border border-border bg-card p-3.5 shadow-2xl shadow-black/25" style={{ ["--z" as string]: "90px", transform: "translateZ(90px)" }}>
          <div className="flex items-center gap-2 mb-2.5">
            <KairosFace size={26} />
            <span className="text-[13px] font-semibold text-foreground">Kairos</span>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> online</span>
          </div>
          <div className="rounded-xl rounded-br-sm bg-primary text-white text-[12px] px-3 py-1.5 ml-8">{t("lp.scene.q")}</div>
          <div className="rounded-xl rounded-tl-sm bg-secondary text-foreground text-[12px] px-3 py-2 mt-2 leading-snug">{t("lp.scene.a")}</div>
        </div>

        {/* calendar */}
        <div className="absolute left-3 sm:left-4 bottom-0 sm:-bottom-2 w-[170px] rounded-2xl border border-border bg-card p-3 shadow-2xl shadow-black/20" style={{ transform: "translateZ(50px)" }}>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground mb-2"><CalendarDays size={13} className="text-primary" /> {t("lp.scene.week")}</div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 21 }, (_, i) => (
              <span key={i} className={`h-[18px] rounded-[4px] ${[2, 3, 8, 9, 10, 15, 16].includes(i) ? "bg-primary/80" : i === 12 ? "bg-amber-400/80" : "bg-secondary"}`} />
            ))}
          </div>
        </div>

        {/* floating badges */}
        <div className="lp-float absolute right-2 top-0 flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-xl" style={{ ["--z" as string]: "120px", transform: "translateZ(120px)", animationDelay: "-2s" }}>
          <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center"><Check size={10} strokeWidth={3} /></span> {t("lp.scene.done")}
        </div>
        <div className="lp-float absolute left-[34%] bottom-[8%] hidden sm:flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-xl" style={{ ["--z" as string]: "70px", transform: "translateZ(70px)", animationDelay: "-4s" }}>
          <Flame size={12} className="text-primary" /> {t("lp.scene.streak")}
        </div>
      </div>
    </div>
  );
}
