import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, SkillLevel } from "../services/api";
import { useI18n } from "../lib/i18n";
import { Page, Section } from "../components/PageHeader";

interface Portfolio { name: string; handle: string; bio: string | null; skills: Array<{ name: string; area: string; level: string; proofs: number }>; projects: Array<{ title: string; description: string | null; repoUrl: string | null; topics: string[] }> }

/** A learner's public portfolio: the levels they reached with the number of proofs behind them, and the projects they chose to show. */
export function PortfolioScreen() {
  const { handle } = useParams();
  const { t } = useI18n();
  const [p, setP] = useState<Portfolio | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    api.publicPortfolio(handle ?? "").then((r) => (r ? setP(r as Portfolio) : setMissing(true)));
  }, [handle]);
  if (missing) return <Page><p className="text-center text-sm text-muted-foreground py-12">{t("portfolio.notFound")}</p></Page>;
  if (!p) return <Page><div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div></Page>;
  return (
    <Page>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{p.name}</h1>
      <p className="text-sm text-muted-foreground">@{p.handle}</p>
      {p.bio && <p className="text-sm text-foreground mt-3">{p.bio}</p>}
      <div className="mt-8" />
      <Section title={t("portfolio.skills")}>
        {p.skills.length === 0 ? <p className="text-sm text-muted-foreground">{t("portfolio.noSkills")}</p> : (
          <div className="flex flex-wrap gap-2">{p.skills.map((s) => <span key={s.name} className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-[13px] font-medium" title={t("portfolio.proofs", { n: s.proofs })}>{s.name} · {t(`skills.level.${s.level as SkillLevel}`)}</span>)}</div>
        )}
        <p className="text-[12px] text-muted-foreground mt-2">{t("portfolio.explain")}</p>
      </Section>
      {p.projects.length > 0 && (
        <Section title={t("portfolio.projects")}>
          <ul className="space-y-3">{p.projects.map((pr) => (
            <li key={pr.title} className="rounded-xl border border-border bg-card px-4 py-3"><p className="font-semibold text-foreground">{pr.repoUrl ? <a href={pr.repoUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{pr.title}</a> : pr.title}</p>{pr.description && <p className="text-sm text-muted-foreground">{pr.description}</p>}{pr.topics.length > 0 && <p className="text-[12px] text-muted-foreground mt-1">{pr.topics.join(" · ")}</p>}</li>
          ))}</ul>
        </Section>
      )}
    </Page>
  );
}
