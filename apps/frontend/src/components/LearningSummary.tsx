import { ArrowRight, Route } from "lucide-react";
import type { LearningPath } from "../services/api";
import { formatMinutes, typeLabel } from "../lib/learning";
import { useI18n } from "../lib/i18n";

/** The learning path inside the profile: where the learner stands and what is next. */
export function LearningSummary({ path, loaded, onOpen, onStart }: { path: LearningPath | null; loaded: boolean; onOpen: () => void; onStart: () => void }) {
  const { t } = useI18n();
  if (!loaded) return <div className="h-40 rounded-2xl bg-secondary animate-pulse" />;
  if (!path) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <Route size={26} className="mx-auto text-muted-foreground" />
        <h3 className="text-base font-semibold text-foreground mt-3">{t("profile.noPath")}</h3>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">{t("profile.noPathText")}</p>
        <button onClick={onStart} className="mt-4 px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold">{t("profile.buildPath")}</button>
      </section>
    );
  }
  const p = path.progress;
  const next = path.next;
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em]">{t("profile.learningPath")}</h3>
          <p className="text-[17px] font-semibold text-foreground leading-snug mt-1">{path.title}</p>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {t("path.summary", { stages: path.stages.length, time: formatMinutes(p.minutesTotal), weeks: p.weeksTotal, hours: path.hoursPerWeek })}
          </p>
        </div>
        <button onClick={onOpen} className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline flex-shrink-0">
          {t("common.open")} <ArrowRight size={14} />
        </button>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="font-semibold text-foreground">{t("path.complete", { n: p.percent })}</span>
          <span className="text-muted-foreground">{t("path.steps", { done: p.doneSteps, total: p.totalSteps })} · {formatMinutes(p.minutesDone)} / {formatMinutes(p.minutesTotal)}</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden mt-1.5" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${p.percent}%` }} />
        </div>
      </div>

      <ol className="flex gap-1.5 mt-3" aria-label="Stages">
        {path.stages.map((s) => (
          <li key={s.index} title={`${s.title}: ${s.done}/${s.total}`} className="flex-1">
            <div className={`h-1.5 rounded-full ${s.complete ? "bg-primary" : s.done > 0 ? "bg-primary/50" : "bg-secondary"}`} />
          </li>
        ))}
      </ol>

      {next && (
        <button onClick={onOpen} className="mt-4 w-full text-left rounded-xl bg-primary/10 border border-primary/30 hover:border-primary/60 transition-colors px-4 py-3">
          <span className="block text-[11px] font-mono uppercase tracking-wide text-primary">{next.status === "doing" ? t("profile.resume") : t("profile.nextUp")}</span>
          <span className="block text-[14.5px] font-semibold text-foreground truncate mt-0.5">{next.content.title}</span>
          <span className="block text-[12px] text-muted-foreground mt-0.5">
            {typeLabel(t, next.content.type)} · {next.content.source} · {formatMinutes(next.minutes)}
          </span>
        </button>
      )}
    </section>
  );
}
