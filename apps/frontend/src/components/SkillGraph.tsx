import { useEffect, useMemo, useRef, useState } from "react";
import type { SkillEdgeView, SkillNodeView } from "../services/api";
import { useI18n } from "../lib/i18n";

interface Props {
  nodes: SkillNodeView[];
  edges: SkillEdgeView[];
  ready: string[];
  onOpen: (slug: string) => void;
}

interface Body { slug: string; name: string; level: string; r: number; x: number; y: number; vx: number; vy: number; fixed: boolean; ghost: boolean }

const FILL: Record<string, string> = {
  applied: "rgb(16 185 129 / 0.85)",
  understood: "color-mix(in srgb, var(--primary, #ea580c) 85%, transparent)",
  learning: "rgb(245 158 11 / 0.85)",
  exploring: "rgb(148 163 184 / 0.7)",
};
const radius = (n: SkillNodeView) => 20 + Math.round(n.mastery * 16) + Math.min(8, n.evidenceCount);

/** Skills as floating bubbles: size is how much you have shown, colour is the level, lines are "needed before". Drag them, click to open. */
export function SkillGraph({ nodes, edges, ready, onOpen }: Props) {
  const { t } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const bodies = useRef<Body[]>([]);
  const [size, setSize] = useState({ w: 640, h: 440 });
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ b: Body; moved: boolean } | null>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const shown = useMemo(() => {
    const readySet = new Set(ready);
    const have = new Set(nodes.map((n) => n.slug));
    return { readySet, edges: edges.filter((e) => !e.hidden && have.has(e.from) && have.has(e.to)) };
  }, [nodes, edges, ready]);

  // Keep the drawing as wide as its container.
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setSize({ w: Math.max(280, el.clientWidth), h: Math.max(420, Math.min(900, window.innerHeight - 300)) });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    measure();
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  // (Re)build the bodies when the data changes, keeping the positions of the ones that stay.
  useEffect(() => {
    const old = new Map(bodies.current.map((b) => [b.slug, b]));
    bodies.current = nodes.map((n, i) => {
      const prev = old.get(n.slug);
      const a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      return { slug: n.slug, name: n.name, level: n.level, r: shown.readySet.has(n.slug) && n.level === "unseen" ? 18 : radius(n), x: prev?.x ?? size.w / 2 + Math.cos(a) * 120, y: prev?.y ?? size.h / 2 + Math.sin(a) * 120, vx: 0, vy: 0, fixed: false, ghost: n.level === "unseen" };
    });
  }, [nodes, shown, size.w, size.h]);

  // The simulation: bodies push each other apart, lines act as springs, a light pull keeps them centred, a slow drift keeps them alive.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    let raf = 0;
    let tick = 0;
    const idx = () => new Map(bodies.current.map((b) => [b.slug, b]));
    const step = () => {
      const bs = bodies.current;
      const map = idx();
      const { w, h } = size;
      tick++;
      for (const a of bs) {
        if (a.fixed) continue;
        a.vx += (w / 2 - a.x) * 0.0016;
        a.vy += (h / 2 - a.y) * 0.0016;
        if (!reduced) { a.vx += Math.sin((tick + a.x) / 90) * 0.012; a.vy += Math.cos((tick + a.y) / 110) * 0.012; }
      }
      for (let i = 0; i < bs.length; i++) {
        for (let j = i + 1; j < bs.length; j++) {
          const a = bs[i]!, b = bs[j]!;
          let dx = b.x - a.x, dy = b.y - a.y;
          let d = Math.hypot(dx, dy) || 0.01;
          const min = a.r + b.r + 10;
          const push = d < min ? (min - d) * 0.05 : d < 160 ? 14 / d : 0;
          dx /= d; dy /= d;
          if (!a.fixed) { a.vx -= dx * push; a.vy -= dy * push; }
          if (!b.fixed) { b.vx += dx * push; b.vy += dy * push; }
        }
      }
      for (const e of shown.edges) {
        const a = map.get(e.from), b = map.get(e.to);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
        const rest = a.r + b.r + 50;
        const f = (d - rest) * 0.004;
        if (!a.fixed) { a.vx += (dx / d) * f; a.vy += (dy / d) * f; }
        if (!b.fixed) { b.vx -= (dx / d) * f; b.vy -= (dy / d) * f; }
      }
      for (const b of bs) {
        if (!b.fixed) {
          b.vx *= 0.9; b.vy *= 0.9;
          b.x = Math.min(w - b.r, Math.max(b.r, b.x + b.vx));
          b.y = Math.min(h - b.r, Math.max(b.r, b.y + b.vy));
        }
        const g = el.querySelector<SVGGElement>(`[data-slug="${CSS.escape(b.slug)}"]`);
        g?.setAttribute("transform", `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`);
      }
      for (const e of shown.edges) {
        const a = map.get(e.from), b = map.get(e.to);
        const l = el.querySelector<SVGLineElement>(`[data-edge="${e.id}"]`);
        if (a && b && l) { l.setAttribute("x1", a.x.toFixed(1)); l.setAttribute("y1", a.y.toFixed(1)); l.setAttribute("x2", b.x.toFixed(1)); l.setAttribute("y2", b.y.toFixed(1)); }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [size, shown, reduced, nodes]);

  const point = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * size.w, y: ((e.clientY - r.top) / r.height) * size.h };
  };
  const down = (e: React.PointerEvent, slug: string) => {
    const b = bodies.current.find((x) => x.slug === slug);
    if (!b) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    b.fixed = true;
    drag.current = { b, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = point(e);
    drag.current.moved = true;
    drag.current.b.x = p.x; drag.current.b.y = p.y; drag.current.b.vx = 0; drag.current.b.vy = 0;
  };
  const up = () => {
    const d = drag.current;
    if (!d) return;
    d.b.fixed = false;
    drag.current = null;
    if (!d.moved) onOpen(d.b.slug);
  };

  const label = (name: string, r: number) => {
    const max = Math.max(4, Math.floor(r / 3.6));
    return name.length > max ? `${name.slice(0, max - 1)}…` : name;
  };

  return (
    <div ref={wrap} className="rounded-2xl border border-border bg-card overflow-hidden touch-none select-none">
      <svg ref={svg} viewBox={`0 0 ${size.w} ${size.h}`} width="100%" height={size.h} role="group" aria-label={t("skills.graph")} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {shown.edges.map((e) => (
          <line key={e.id} data-edge={e.id} stroke="currentColor" className="text-muted-foreground/40" strokeWidth={e.type === "prerequisite" ? 1.6 : 1} strokeDasharray={e.type === "related" ? "3 4" : undefined} />
        ))}
        {nodes.map((n) => {
          const ghost = n.level === "unseen";
          const r = ghost && shown.readySet.has(n.slug) ? 18 : radius(n);
          return (
            <g key={n.slug} data-slug={n.slug} transform={`translate(${size.w / 2} ${size.h / 2})`} className="cursor-pointer" tabIndex={0} role="button" aria-label={`${n.name}, ${t(`skills.level.${n.level}`)}`}
              onPointerDown={(e) => down(e, n.slug)} onPointerEnter={() => setHover(n.slug)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(n.slug)} onBlur={() => setHover(null)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(n.slug); } }}>
              <circle r={r} fill={ghost ? "transparent" : FILL[n.level]} stroke={ghost ? "currentColor" : "rgb(255 255 255 / 0.5)"} strokeWidth={ghost ? 1.5 : 2} strokeDasharray={ghost ? "4 4" : undefined} className={ghost ? "text-muted-foreground/60" : ""} style={{ transition: "r 0.3s" }} />
              {ghost ? (
                <text textAnchor="middle" y={r + 13} fontSize={10} fontWeight={500} fill="currentColor" className="text-muted-foreground" pointerEvents="none">{n.name.length > 18 ? `${n.name.slice(0, 17)}…` : n.name}</text>
              ) : (
                <text textAnchor="middle" dy="0.35em" fontSize={r > 30 ? 12 : 10} fontWeight={600} fill="white" pointerEvents="none">{label(n.name, r)}</text>
              )}
              {hover === n.slug && (
                <g pointerEvents="none" transform={`translate(0 ${-r - 14})`}>
                  <rect x={-70} y={-13} width={140} height={22} rx={6} fill="rgb(15 23 42 / 0.92)" />
                  <text textAnchor="middle" dy="0.3em" fontSize={11} fill="white">{n.name} · {t(`skills.level.${n.level}`)}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 border-t border-border text-[12px] text-muted-foreground">
        {(["applied", "understood", "learning", "exploring"] as const).map((l) => (
          <li key={l} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: FILL[l] }} />{t(`skills.level.${l}`)}</li>
        ))}
        <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border border-dashed border-muted-foreground" />{t("skills.ready")}</li>
      </ul>
    </div>
  );
}
