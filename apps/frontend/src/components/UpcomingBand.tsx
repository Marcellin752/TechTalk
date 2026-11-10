import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ExternalLink } from "lucide-react";
import { api, UpcomingItem } from "../services/api";
import { ROUTES } from "../lib/routes";
import { dateLocale, useI18n } from "../lib/i18n";
import { formatMinutes } from "../lib/learning";

/** What is coming up at school, and what to review for it: each deadline tied to the stage of your path that prepares for it. */
export function UpcomingBand() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<UpcomingItem[] | null>(null);
  useEffect(() => {
    api.getUpcoming().then(setItems).catch(() => setItems([]));
  }, []);
  if (!items || items.length === 0) return null;
  const when = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(lang), { weekday: "short", day: "numeric", month: "short" });

  return (
    <section aria-label={t("upcoming.title")} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2"><CalendarClock size={16} className="text-primary" /> {t("upcoming.title")}</h2>
      <ul className="mt-3 divide-y divide-border">
        {items.slice(0, 4).map((it) => (
          <li key={it.event.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${it.daysLeft <= 7 ? "bg-red-500/15 text-red-600" : "bg-secondary text-muted-foreground"}`}>{t("upcoming.days", { n: it.daysLeft })}</span>
              <span className="text-[14px] font-medium text-foreground">{it.event.title}</span>
              <span className="text-[12px] text-muted-foreground ml-auto">{when(it.event.startsAt)}</span>
            </div>
            {it.stage ? (
              <div className="mt-2 pl-1">
                <p className="text-[12.5px] text-muted-foreground">
                  {t("upcoming.prepares")} <Link to={`${ROUTES.path}?p=${it.stage.pathId}`} className="text-primary hover:underline font-medium">{it.stage.title}</Link> · {t("path.doneOf", { done: it.stage.done, total: it.stage.total })}
                </p>
                {it.todo.length > 0 ? (
                  <ul className="mt-1.5 space-y-1">
                    {it.todo.map((s) => (
                      <li key={s.id}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-foreground hover:text-primary">
                          <ExternalLink size={12} className="text-muted-foreground" /> {s.title} <span className="text-muted-foreground text-[11.5px]">· {formatMinutes(s.minutes)}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : it.stage.checkpointPassed ? <p className="text-[12.5px] text-emerald-600 mt-1">{t("upcoming.ready")}</p> : <p className="text-[12.5px] text-muted-foreground mt-1">{t("upcoming.takeQuiz")}</p>}
              </div>
            ) : <p className="text-[12.5px] text-muted-foreground mt-1.5 pl-1">{t("upcoming.noStage")}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
