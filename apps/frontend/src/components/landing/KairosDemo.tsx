import { useEffect, useState } from "react";
import { BookOpen, ExternalLink } from "lucide-react";
import { KairosFace } from "../KairosArt";
import { useReducedMotion } from "../../lib/motion";
import { useI18n } from "../../lib/i18n";
import type { Keys } from "../../locales/en";

interface Demo {
  tab: Keys;
  q: Keys;
  a: Keys;
  code?: string;
  sources?: Array<{ n: number; title: string; source: string }>;
  chips?: Keys[];
}

const DEMOS: Demo[] = [
  {
    tab: "lp.kd.1.tab", q: "lp.kd.1.q", a: "lp.kd.1.a",
    sources: [{ n: 1, title: "Beej's Guide to C Programming", source: "Beej" }, { n: 2, title: "Learn C", source: "learn-c.org" }],
    chips: ["lp.kd.1.c1", "lp.kd.1.c2"],
  },
  {
    tab: "lp.kd.2.tab", q: "lp.kd.2.q", a: "lp.kd.2.a",
    code: "def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        # TODO: what value would pair with n?\n        # have you already seen it?\n        ...",
    chips: ["lp.kd.2.c1"],
  },
  { tab: "lp.kd.3.tab", q: "lp.kd.3.q", a: "lp.kd.3.a", chips: ["lp.kd.3.c1", "lp.kd.3.c2"] },
];

/** A scripted conversation that shows how Kairos answers. The answer types itself out, unless the person prefers less motion. */
export function KairosDemo() {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const demo = DEMOS[i]!;
  const full = t(demo.a);
  const [shown, setShown] = useState(full.length);

  useEffect(() => {
    if (reduced) return setShown(full.length);
    setShown(0);
    const id = window.setInterval(() => setShown((n) => (n >= full.length ? (window.clearInterval(id), n) : n + 2)), 16);
    return () => window.clearInterval(id);
  }, [i, full, reduced]);

  const done = shown >= full.length;
  return (
    <div className="rounded-3xl border border-border bg-card shadow-2xl shadow-black/10 overflow-hidden">
      <div role="tablist" aria-label={t("lp.kd.examples")} className="flex gap-1 p-2 border-b border-border bg-secondary/50 overflow-x-auto no-scrollbar">
        {DEMOS.map((d, k) => (
          <button key={d.tab} role="tab" aria-selected={i === k} onClick={() => setI(k)} className={`flex-shrink-0 px-3.5 h-9 rounded-xl text-[13px] font-medium transition-colors ${i === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t(d.tab)}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6 space-y-4 min-h-[360px]" aria-live="polite">
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-white px-4 py-2.5 text-[14px] leading-relaxed">{t(demo.q)}</div>
        </div>
        <div className="flex gap-3">
          <KairosFace size={32} />
          <div className="min-w-0 max-w-[92%]">
            <div className="rounded-2xl rounded-tl-md bg-secondary px-4 py-3 text-[14px] leading-relaxed text-foreground whitespace-pre-wrap">
              {full.slice(0, shown)}
              {!done && <span className="inline-block w-1.5 h-4 -mb-0.5 ml-0.5 bg-primary animate-pulse" />}
              {done && demo.code && <pre className="mt-3 rounded-xl bg-background border border-border p-3 text-[12px] font-mono leading-relaxed overflow-x-auto"><code>{demo.code}</code></pre>}
            </div>
            {done && demo.sources && (
              <ul className="mt-2 flex flex-col gap-1.5">
                {demo.sources.map((s) => (
                  <li key={s.n} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12.5px]">
                    <span className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">{s.n}</span>
                    <BookOpen size={12} className="text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-foreground">{s.title}</span>
                    <span className="text-muted-foreground hidden sm:inline">{s.source}</span>
                    <ExternalLink size={12} className="text-muted-foreground" />
                  </li>
                ))}
              </ul>
            )}
            {done && demo.chips && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {demo.chips.map((c) => <span key={c} className="px-3 py-1.5 rounded-full border border-border bg-card text-[12.5px] text-foreground">{t(c)}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
