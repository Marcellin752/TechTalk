import { useEffect, useMemo, useState } from "react";
import { Bookmark, Calendar, Check, Plus, Search } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useSeo } from "../lib/seo";
import { KIND_STYLE } from "../lib/calendar";
import { KairosFace } from "../components/KairosArt";

/* The design system, live. Every colour below is read from the page's own CSS variables,
   so this page always shows what actually ships, in the current theme. It is public and
   plain HTML on purpose: people, screenshots and AI assistants can all see the design. */

const COLORS = [
  "background", "foreground", "card", "secondary", "muted", "muted-foreground", "primary", "primary-foreground",
  "destructive", "border", "ring", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
] as const;

function useCssVars(names: readonly string[]) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const style = getComputedStyle(document.documentElement);
      setValues(Object.fromEntries(names.map((n) => [n, style.getPropertyValue(`--${n}`).trim()])));
    };
    read();
    // The theme switch toggles a class on <html>.
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [names]);
  return values;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-10" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="text-[11px] font-mono uppercase tracking-[0.15em] text-primary mb-4">{title}</h2>
      {children}
    </section>
  );
}

export function DesignScreen() {
  const { lang } = useI18n();
  const colors = useMemo(() => COLORS, []);
  const vars = useCssVars(colors);
  useSeo({ title: "Design system", description: "The TechTalk design system: colours, type, components.", path: "/design", noindex: true }, lang);

  return (
    <main className="flex-1 overflow-y-auto bg-background" data-testid="design-system">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-20">
        <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-primary">Design system</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mt-1">TechTalk</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          Clean surfaces, rounded cards, one warm orange accent, light and dark themes. Everything here is rendered from the live CSS variables of the current theme; the same values are published as data in{" "}
          <a className="text-primary underline" href="/design-tokens.json">/design-tokens.json</a>.
        </p>

        <Section id="colors" title="Colour (current theme)">
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {colors.map((name) => (
              <li key={name} className="rounded-xl border border-border overflow-hidden bg-card">
                <div className="h-14 border-b border-border" style={{ background: `var(--${name})` }} />
                <div className="p-2.5">
                  <div className="text-[13px] font-medium text-foreground">{name}</div>
                  <div className="text-[11px] font-mono text-muted-foreground break-all">{vars[name] ?? ""}</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="kinds" title="Calendar kinds">
          <div className="flex flex-wrap gap-3">
            {(Object.keys(KIND_STYLE) as (keyof typeof KIND_STYLE)[]).map((k) => (
              <span key={k} className={`inline-flex items-center gap-2 px-3 h-8 rounded-lg text-[13px] font-medium ${KIND_STYLE[k].chip}`}>
                <span className={`w-2 h-2 rounded-full ${KIND_STYLE[k].dot}`} /> {k}
              </span>
            ))}
          </div>
        </Section>

        <Section id="type" title="Typography: Inter, with JetBrains Mono for labels">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="text-3xl font-bold tracking-tight text-foreground">Page title, 30px bold</div>
            <div className="text-xl font-bold tracking-tight text-foreground">Card title, 20px bold</div>
            <div className="text-[16px] font-semibold text-foreground">Section title, 16px semibold</div>
            <p className="text-sm text-foreground leading-relaxed">Body text, 14px. It stays readable at length and never goes below 4.5:1 contrast.</p>
            <p className="text-xs text-muted-foreground">Caption, 12px, muted foreground.</p>
            <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Eyebrow label, mono 11px</p>
          </div>
        </Section>

        <Section id="buttons" title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold shadow-md shadow-primary/25"><Plus size={16} /> Primary</button>
            <button className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10"><Check size={16} /> Accent outline</button>
            <button className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-secondary"><Calendar size={16} /> Neutral outline</button>
            <button className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10">Destructive</button>
            <button disabled className="px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold opacity-50">Disabled</button>
            <button aria-label="Bookmark" className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"><Bookmark size={18} /></button>
          </div>
        </Section>

        <Section id="inputs" title="Inputs and chips">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs font-medium text-muted-foreground mb-1.5">Label</span>
              <input placeholder="Placeholder" className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input aria-label="Search" placeholder="Search" className="h-10 w-full rounded-xl bg-secondary border border-border pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <span className="px-3.5 h-8 inline-flex items-center rounded-lg bg-foreground text-background text-[13px] font-medium">Selected</span>
              <span className="px-3.5 h-8 inline-flex items-center rounded-lg bg-secondary text-foreground text-[13px] font-medium">Filter</span>
              <span className="px-2.5 h-7 inline-flex items-center rounded-full bg-primary/10 text-primary text-[13px]">topic</span>
              <span className="px-2 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-bold tracking-wide">AI</span>
            </div>
          </div>
        </Section>

        <Section id="cards" title="Cards and surfaces">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border bg-card p-4"><div className="text-[15px] font-semibold text-foreground">Card</div><p className="text-[13px] text-muted-foreground mt-1">Surface above the page, 1px visible border, 16px radius.</p></div>
            <div className="rounded-2xl bg-secondary p-4"><div className="text-[15px] font-semibold text-foreground">Secondary panel</div><p className="text-[13px] text-muted-foreground mt-1">Soft fill, no border, for grouped content.</p></div>
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4"><div className="text-[15px] font-semibold text-foreground">Highlight</div><p className="text-[13px] text-muted-foreground mt-1">The one thing to do next.</p></div>
          </div>
        </Section>

        <Section id="kairos" title="Kairos">
          <div className="flex items-center gap-4">
            <KairosFace size={56} />
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">The AI mentor: a serene bald head with a single lock of hair in the wind, in the brand orange. It replaces any generic sparkle icon.</p>
          </div>
        </Section>

        <Section id="rules" title="Rules">
          <ul className="list-disc pl-5 text-sm text-foreground space-y-1.5 leading-relaxed">
            <li>Colours come from the CSS variables above, never hard-coded, so both themes work.</li>
            <li>Interactive targets are at least 32px (40px for primary actions); focus is always visible.</li>
            <li>Motion is decorative and switches off under <code className="font-mono text-[12px]">prefers-reduced-motion</code>.</li>
            <li>Every screen works from 360px wide; side menu on computers, bottom bar on phones.</li>
            <li>Full guide: <code className="font-mono text-[12px]">docs/DESIGN.md</code>.</li>
          </ul>
        </Section>
      </div>
    </main>
  );
}
