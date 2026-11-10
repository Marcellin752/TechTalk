import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useI18n } from "../lib/i18n";
import { ghostCls, Page, PageHeader, Section } from "../components/PageHeader";

interface Action { id: string; kind: string; title: string; reason: string; link: string }
interface Briefing { actions: Action[]; today: Array<{ id: string; title: string; kind: string; startsAt: string }>; streak: number; rising: Array<{ topic: string; change: number }> }
interface Item { id: string; title: string; url: string; source: string; concept: string; slug: string; reason: string }

/** The day at a glance: what to do and why, what is rising in your field, and what to read next. */
export function TodayScreen() {
  const { t } = useI18n();
  const [b, setB] = useState<Briefing | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [coaching, setCoaching] = useState(false);

  useEffect(() => {
    const tz = -new Date().getTimezoneOffset();
    api.growth<Briefing>(`/briefing?tz=${tz}`).then((r) => setB(r.data ?? { actions: [], today: [], streak: 0, rising: [] }));
    api.growth<{ items: Item[] }>("/discover").then((r) => setItems(r.data?.items ?? []));
  }, []);

  const coach = async () => {
    setCoaching(true);
    const r = await api.growth<{ note: string | null }>(`/coach?tz=${-new Date().getTimezoneOffset()}`, "POST", {});
    setCoaching(false);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    setNote(r.data?.note ?? t("today.noNote"));
  };

  return (
    <Page>
      <PageHeader icon={CalendarCheck} title={t("today.title")} subtitle={t("today.subtitle")} />
      {!b && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>}
      {b && (
        <>
          <Section title={t("today.next")}>
            {b.actions.length === 0 ? <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{t("today.nothing")}</p> : (
              <ol className="space-y-2">
                {b.actions.map((a, i) => (
                  <li key={a.id}><Link to={a.link} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-secondary">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[12px] font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="min-w-0 flex-1"><span className="block font-medium text-foreground truncate">{a.title}</span><span className="block text-[12px] text-muted-foreground">{a.reason}</span></span>
                  </Link></li>
                ))}
              </ol>
            )}
            <button onClick={coach} disabled={coaching || b.actions.length === 0} className={`${ghostCls} mt-3`}>{coaching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {t("today.coach")}</button>
            {note && <p className="rounded-2xl border border-primary/30 bg-primary/5 p-4 mt-3 text-sm text-foreground whitespace-pre-wrap">{note}</p>}
          </Section>
          {b.today.length > 0 && (
            <Section title={t("today.calendar")}>
              <ul className="space-y-1.5 text-sm">{b.today.map((e) => <li key={e.id} className="text-foreground">{new Date(e.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {e.title}</li>)}</ul>
            </Section>
          )}
          {b.rising.length > 0 && (
            <Section title={t("today.rising")}>
              <div className="flex flex-wrap gap-2">{b.rising.map((r) => <span key={r.topic} className="px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[13px] font-medium">{r.topic} ↑</span>)}</div>
            </Section>
          )}
        </>
      )}
      <Section title={t("today.discover")}>
        {items === null && <Loader2 className="animate-spin text-primary mx-auto" />}
        {items && items.length === 0 && <p className="text-sm text-muted-foreground">{t("today.noDiscover")}</p>}
        <ul className="space-y-2">
          {items?.map((i) => (
            <li key={i.id} className="rounded-xl border border-border bg-card px-4 py-3">
              <a href={i.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{i.title}</a>
              <p className="text-[12px] text-muted-foreground mt-0.5">{i.source} · <Link to={`/skills/${i.slug}`} className="underline underline-offset-2">{i.concept}</Link> — {i.reason}</p>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}
