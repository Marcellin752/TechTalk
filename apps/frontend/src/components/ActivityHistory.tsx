import { useEffect, useState } from "react";
import { BookOpenCheck, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, ActivityItem } from "../services/api";
import { typeLabel } from "../lib/learning";
import { dateLocale, useI18n, type Lang, type T } from "../lib/i18n";

function dayLabel(iso: string, t: T, lang: Lang): string {
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return t("profile.today");
  if (days === 1) return t("profile.yesterday");
  if (days < 7) return d.toLocaleDateString(dateLocale(lang), { weekday: "long" });
  return d.toLocaleDateString(dateLocale(lang), { month: "long", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

const time = (iso: string, lang: Lang) => new Date(iso).toLocaleTimeString(dateLocale(lang), { hour: "numeric", minute: "2-digit" });

/** What the learner opened and which steps they finished, newest first, grouped by day. */
export function ActivityHistory() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.getHistory().then(setItems).catch(() => setFailed(true));
  }, []);

  const clear = async () => {
    if (!window.confirm(t("profile.historyConfirm"))) return;
    if (!(await api.clearHistory())) return void toast.error(t("path.saveError"));
    setItems((all) => (all ?? []).filter((i) => i.kind === "step"));
    toast.success(t("profile.historyCleared"));
  };

  const groups = new Map<string, ActivityItem[]>();
  for (const it of items ?? []) {
    const key = dayLabel(it.at, t, lang);
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em]">{t("profile.history")}</h3>
        {items && items.some((i) => i.kind === "read") && (
          <button onClick={clear} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-destructive">
            <Trash2 size={12} /> {t("profile.historyClear")}
          </button>
        )}
      </div>

      {failed ? (
        <p className="text-sm text-muted-foreground">{t("common.couldNotLoad")}</p>
      ) : items === null ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 rounded-xl bg-secondary animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-5 text-center">{t("profile.historyEmpty")}</p>
      ) : (
        <div className="space-y-5">
          {[...groups.entries()].map(([day, rows]) => (
            <div key={day}>
              <p className="text-[12px] font-semibold text-foreground mb-1.5">{day}</p>
              <ul className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {rows.map((it, i) => (
                  <li key={`${it.kind}-${it.content.id}-${i}`}>
                    <a href={it.content.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-secondary/60 transition-colors">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${it.kind === "step" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                        {it.kind === "step" ? <BookOpenCheck size={14} /> : <Eye size={14} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] text-foreground truncate">{it.content.title}</span>
                        <span className="block text-[11.5px] text-muted-foreground truncate">
                          {it.kind === "step" ? t("profile.finished") : t("profile.opened")} · {typeLabel(t, it.content.type)} · {it.content.source}
                        </span>
                      </span>
                      <span className="text-[11.5px] text-muted-foreground flex-shrink-0">{time(it.at, lang)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
