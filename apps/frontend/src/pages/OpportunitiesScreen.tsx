import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, ExternalLink, GitPullRequest, MapPin } from "lucide-react";
import { api, OpportunityItem } from "../services/api";
import { ROUTES } from "../lib/routes";
import { useI18n } from "../lib/i18n";

/** Open-source issues and jobs that match what you can do: your languages and the stages you have finished. Early on, issues to learn from; later, internships; then jobs. */
export function OpportunitiesScreen() {
  const { t } = useI18n();
  const [data, setData] = useState<{ skills: string[]; year: number | null; items: OpportunityItem[] } | null>(null);
  useEffect(() => {
    api.getOpportunities().then(setData);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-16">
        <div className="text-center mb-8">
          <span className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto"><Briefcase size={24} /></span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-3">{t("opp.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-lg mx-auto leading-relaxed">{t("opp.subtitle")}</p>
        </div>

        {data && data.skills.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2">{t("opp.basedOn")}</p>
            <div className="flex flex-wrap gap-1.5">{data.skills.map((s) => <span key={s} className="px-2.5 h-6 inline-flex items-center rounded-full bg-primary/10 text-primary text-[12px]">{s}</span>)}</div>
          </div>
        )}

        {data === null && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-secondary animate-pulse" />)}</div>}
        {data && data.items.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-[15px] font-semibold text-foreground">{t("opp.none")}</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">{t("opp.noneText")}</p>
            <Link to={ROUTES.path} className="inline-flex items-center px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold mt-4">{t("nav.path")}</Link>
          </div>
        )}
        <ul className="space-y-3">
          {data?.items.map((o) => (
            <li key={o.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-foreground font-semibold">{o.kind === "issue" ? <><GitPullRequest size={11} /> {t("opp.issue")}</> : o.internship ? <><Briefcase size={11} /> {t("opp.internship")}</> : <><Briefcase size={11} /> {t("opp.job")}</>}</span>
                {o.repo && <span className="font-mono text-muted-foreground">{o.repo}</span>}
                {o.company && <span className="text-muted-foreground">{o.company}</span>}
                {o.location && <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin size={11} /> {o.location}</span>}
              </div>
              <a href={o.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-start gap-1.5 text-[16px] font-semibold text-foreground hover:text-primary mt-1.5">{o.title} <ExternalLink size={13} className="mt-1.5 flex-shrink-0" /></a>
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-[12px] text-muted-foreground">{t("opp.matches")}</span>
                {o.matched.map((m) => <span key={m} className="px-2 h-5 inline-flex items-center rounded-full bg-primary/10 text-primary text-[11.5px]">{m}</span>)}
                {o.labels.map((l) => <span key={l} className="px-2 h-5 inline-flex items-center rounded-full bg-secondary text-muted-foreground text-[11.5px]">{l}</span>)}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
