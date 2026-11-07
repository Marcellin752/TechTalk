import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useI18n } from "../lib/i18n";
import { Page, PageHeader, Section } from "../components/PageHeader";

interface Analytics {
  weeks: Array<{ week: string; exposure: number; shown: number }>;
  streak: { current: number; best: number };
  activeDays30: number;
  areas: Array<{ area: string; understood: number; learning: number; exploring: number }>;
  concepts: { seen: number; shown: number; onlyConsulted: number };
  improving: Array<{ slug: string; name: string }>;
  fading: Array<{ slug: string; name: string }>;
}
interface Trend { topic: string; change: number; mine: string | null }

/** How you are growing, told honestly: what you consulted against what you showed. */
export function GrowthScreen() {
  const { t } = useI18n();
  const [a, setA] = useState<Analytics | null>(null);
  const [trends, setTrends] = useState<{ rising: Trend[]; cooling: Trend[] } | null>(null);
  const [pf, setPf] = useState<{ public: boolean; handle: string | null; profilePublic: boolean } | null>(null);

  useEffect(() => {
    api.growth<Analytics>(`/analytics?tz=${-new Date().getTimezoneOffset()}`).then((r) => r.data && setA(r.data));
    api.growth<{ rising: Trend[]; cooling: Trend[] }>("/trends").then((r) => setTrends(r.data ?? { rising: [], cooling: [] }));
    api.growth<{ public: boolean; handle: string | null; profilePublic: boolean }>("/portfolio").then((r) => r.data && setPf(r.data));
  }, []);

  const togglePortfolio = async () => {
    if (!pf) return;
    const r = await api.growth<{ public: boolean; handle: string | null }>("/portfolio", "PUT", { public: !pf.public });
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    setPf({ ...pf, public: r.data!.public });
  };
  const max = Math.max(1, ...(a?.weeks.map((w) => w.exposure + w.shown) ?? [1]));

  return (
    <Page>
      <PageHeader icon={TrendingUp} title={t("growth.title")} subtitle={t("growth.subtitle")} />
      {!a && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>}
      {a && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-7 text-center">
            {[[a.streak.current, t("growth.streak")], [a.activeDays30, t("growth.active30")], [a.concepts.shown, t("growth.shown")]].map(([n, l]) => (
              <div key={String(l)} className="rounded-2xl border border-border bg-card p-4"><p className="text-2xl font-bold text-foreground">{n}</p><p className="text-[12px] text-muted-foreground">{l}</p></div>
            ))}
          </div>
          {a.concepts.seen > 0 && <p className="text-sm text-muted-foreground mb-7">{t("growth.gap", { seen: a.concepts.seen, shown: a.concepts.shown, only: a.concepts.onlyConsulted })}</p>}

          <Section title={t("growth.weekly")}>
            {a.weeks.length === 0 ? <p className="text-sm text-muted-foreground">{t("growth.noWeeks")}</p> : (
              <div className="flex items-end gap-1.5 h-32" role="img" aria-label={t("growth.weekly")}>
                {a.weeks.map((w) => (
                  <div key={w.week} className="flex-1 flex flex-col justify-end h-full" title={`${w.week}: ${w.shown} / ${w.exposure}`}>
                    <div className="bg-primary rounded-t" style={{ height: `${(w.shown / max) * 100}%` }} />
                    <div className="bg-primary/30" style={{ height: `${(w.exposure / max) * 100}%` }} />
                  </div>
                ))}
              </div>
            )}
            <p className="text-[12px] text-muted-foreground mt-2"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary mr-1" />{t("growth.legendShown")} <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/30 ml-3 mr-1" />{t("growth.legendConsulted")}</p>
          </Section>

          {a.areas.length > 0 && (
            <Section title={t("growth.areas")}>
              <ul className="space-y-2">
                {a.areas.map((r) => {
                  const total = r.understood + r.learning + r.exploring;
                  return (
                    <li key={r.area} className="text-sm">
                      <div className="flex justify-between text-foreground"><span>{r.area}</span><span className="text-muted-foreground">{r.understood}/{total}</span></div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-secondary mt-1">
                        <div className="bg-emerald-500" style={{ width: `${(r.understood / total) * 100}%` }} /><div className="bg-amber-500" style={{ width: `${(r.learning / total) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
          {(a.improving.length > 0 || a.fading.length > 0) && (
            <Section title={t("growth.movement")}>
              <div className="flex flex-wrap gap-2">
                {a.improving.map((c) => <Link key={c.slug} to={`/skills/${c.slug}`} className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[13px] font-medium">{c.name} ↑</Link>)}
                {a.fading.map((c) => <Link key={c.slug} to={`/skills/${c.slug}`} className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[13px] font-medium">{c.name} ↓</Link>)}
              </div>
            </Section>
          )}
        </>
      )}

      <Section title={t("growth.tech")}>
        {!trends && <Loader2 className="animate-spin text-primary mx-auto" />}
        {trends && trends.rising.length === 0 && <p className="text-sm text-muted-foreground">{t("growth.noTrends")}</p>}
        <div className="flex flex-wrap gap-2">
          {trends?.rising.map((r) => <span key={r.topic} className={`px-3 py-1.5 rounded-xl text-[13px] font-medium ${r.mine ? "bg-primary/15 text-primary" : "bg-secondary text-foreground"}`}>{r.topic} +{r.change}</span>)}
        </div>
        {trends && trends.cooling.length > 0 && <p className="text-[12px] text-muted-foreground mt-2">{t("growth.cooling")}: {trends.cooling.map((c) => c.topic).join(", ")}</p>}
      </Section>

      {pf && (
        <Section title={t("growth.portfolio")}>
          <p className="text-sm text-muted-foreground mb-2">{t("growth.portfolioHelp")}</p>
          <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={pf.public} onChange={togglePortfolio} /> {t("growth.portfolioOn")}</label>
          {!pf.profilePublic && <p className="text-[12px] text-muted-foreground mt-1">{t("growth.portfolioNeedsProfile")}</p>}
          {pf.public && pf.handle && <Link to={`/p/${pf.handle}`} className="text-sm text-primary underline underline-offset-2 mt-2 inline-block">/p/{pf.handle}</Link>}
        </Section>
      )}
    </Page>
  );
}
