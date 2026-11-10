import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Brain, Flame, Target, Users } from "lucide-react";
import { api, WeekSummary } from "../services/api";
import { ROUTES } from "../lib/routes";
import { dateLocale, useI18n } from "../lib/i18n";

/** The week at a glance: a discreet streak, the time goal, what was done, reviews waiting and (if the learner shares) how the class is doing. On Sundays it is the week in review. */
export function WeekCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t, lang } = useI18n();
  const [w, setW] = useState<WeekSummary | null>(null);
  useEffect(() => {
    api.getWeek().then(setW);
  }, [refreshKey]);
  if (!w) return null;
  const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale(lang), { weekday: "narrow" });
  const hours = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;

  return (
    <section className={`rounded-2xl border bg-card p-4 sm:p-5 ${w.isSunday ? "border-primary/50 bg-primary/[.04]" : "border-border"}`} aria-label={t("week.title")}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-foreground">{w.isSunday ? t("week.sunday") : t("week.title")}</h2>
          <div className="flex items-center gap-2 mt-1.5" title={t("week.streakTip")}>
            <Flame size={16} className={w.streak.current > 0 ? "text-primary" : "text-muted-foreground"} />
            <span className="text-[13px] font-semibold text-foreground">{t("week.streak", { n: w.streak.current })}</span>
            <span className="flex gap-1 ml-1" aria-hidden>
              {w.streak.week.map((d) => (
                <span key={d.date} className="flex flex-col items-center gap-0.5">
                  <span className={`w-3.5 h-3.5 rounded-full ${d.active ? "bg-primary" : "bg-secondary border border-border"}`} />
                  <span className="text-[9px] text-muted-foreground">{day(d.date)}</span>
                </span>
              ))}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center justify-between text-[12.5px] mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Target size={13} /> {t("week.goal")}</span>
            <span className="font-medium text-foreground">{hours(w.goal.done)} / {hours(w.goal.target)}</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={w.goal.percent} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full rounded-full transition-all duration-500 ${w.goal.reached ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${w.goal.percent}%` }} />
          </div>
          <p className="text-[12px] text-muted-foreground mt-1.5">{t("week.done", { steps: w.week.steps, reviews: w.week.reviews, quizzes: w.week.quizzesPassed })}</p>
        </div>

        {w.reviewsDue > 0 && (
          <Link to={ROUTES.review} className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-[13px] font-semibold shadow-md shadow-primary/25">
            <Brain size={15} /> {t("week.reviewDue", { n: w.reviewsDue })}
          </Link>
        )}
      </div>

      {w.challenge && (
        <p className="mt-3 pt-3 border-t border-border text-[12.5px] text-muted-foreground flex items-center gap-2">
          <Users size={14} className="text-primary flex-shrink-0" />
          {t("week.class", { students: w.challenge.students, hours: w.challenge.hours })}
          {w.challenge.changePercent !== null && <span className={w.challenge.changePercent >= 0 ? "text-emerald-600 font-medium" : "text-muted-foreground"}> {w.challenge.changePercent >= 0 ? "+" : ""}{w.challenge.changePercent}% {t("week.vsLast")}</span>}
        </p>
      )}
    </section>
  );
}
