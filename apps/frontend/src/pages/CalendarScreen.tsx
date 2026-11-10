import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, ExternalLink, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, CalendarEvent, CalendarKind, PathSummary } from "../services/api";
import { dateLocale, useI18n } from "../lib/i18n";
import { KIND_STYLE, dayKey, fromInputs, groupByDay, monthGrid, sameDay, toDateInput, toTimeInput } from "../lib/calendar";
import type { Keys } from "../locales/en";
import { Modal } from "../components/Modal";

const KINDS: CalendarKind[] = ["study", "school", "deadline", "event"];
const field = "w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary";

function EventDialog({ event, day, onClose, onSaved }: { event: CalendarEvent | null; day: Date; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const start = event ? new Date(event.startsAt) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 18, 0);
  const end = event ? new Date(event.endsAt) : new Date(start.getTime() + 60 * 60000);
  const [title, setTitle] = useState(event?.title ?? "");
  const [kind, setKind] = useState<CalendarKind>(event?.kind ?? "event");
  const [date, setDate] = useState(toDateInput(start));
  const [from, setFrom] = useState(toTimeInput(start));
  const [to, setTo] = useState(toTimeInput(end));
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return void toast.error(t("cal.needTitle"));
    const startsAt = fromInputs(date, from);
    let endsAt = fromInputs(date, to);
    if (!startsAt || !endsAt || endsAt <= startsAt) return void toast.error(t("cal.badTimes"));
    setSaving(true);
    const input = { title: title.trim(), kind, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), notes: notes.trim() || null };
    const res = event ? await api.updateEvent(event.id, input) : await api.createEvent(input);
    setSaving(false);
    if (!res.success) return void toast.error(res.error || t("admin.error"));
    toast.success(t("cal.saved"));
    onSaved();
    onClose();
  };

  return (
    <Modal title={event ? t("cal.editEvent") : t("cal.new")} onClose={onClose}>
      <div className="px-5 py-4 space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("cal.eventTitle")}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className={field} autoFocus />
        </label>
        <div>
          <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("cal.kind")}</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("cal.kind")}>
            {KINDS.map((k) => (
              <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`px-3 h-8 rounded-lg text-[13px] font-medium border transition-colors ${kind === k ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${KIND_STYLE[k].dot}`} />
                {t(`cal.kind.${k}` as Keys)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="block col-span-3 sm:col-span-1">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("cal.date")}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("cal.start")}</span>
            <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("cal.end")}</span>
            <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
          </label>
        </div>
        <label className="block">
          <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("cal.notes")}</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3} className={`${field} resize-none`} />
        </label>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-5">
        <button onClick={onClose} className="px-4 h-10 rounded-xl border border-border text-sm text-foreground hover:bg-secondary">{t("common.cancel")}</button>
        <button onClick={save} disabled={saving} className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60">{t("common.save")}</button>
      </div>
    </Modal>
  );
}

function PlanDialog({ onClose, onPlanned }: { onClose: () => void; onPlanned: () => void }) {
  const { t } = useI18n();
  const names = t("cal.dayNames").split(",");
  const order = [1, 2, 3, 4, 5, 6, 0]; // Monday first
  const [hour, setHour] = useState(18);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [weeks, setWeeks] = useState(4);
  const [busy, setBusy] = useState(false);
  const [paths, setPaths] = useState<PathSummary[]>([]);
  const [pathId, setPathId] = useState("");
  useEffect(() => {
    api.getPaths().then((r) => setPaths(r.paths)).catch(() => undefined);
  }, []);

  const go = async () => {
    setBusy(true);
    const res = await api.planCalendar({ startHour: hour, days, weeks, ...(pathId ? { pathId } : {}) });
    setBusy(false);
    if (!res.success) return void toast.error(res.error?.includes("path") ? t("cal.planNeedPath") : res.error || t("admin.error"));
    toast.success(res.planned > 0 ? t("cal.planned", { n: res.planned }) : t("cal.planNone"));
    onPlanned();
    onClose();
  };

  return (
    <Modal title={t("cal.planTitle")} onClose={onClose}>
      <div className="px-5 py-4 space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">{t("cal.planText")}</p>
        {paths.length > 1 && (
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("cal.planPath")}</span>
            <select value={pathId} onChange={(e) => setPathId(e.target.value)} className={field}>
              <option value="">{t("paths.main")}</option>
              {paths.filter((p) => !p.active).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
        )}
        <label className="block">
          <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("cal.planHour")}</span>
          <select value={hour} onChange={(e) => setHour(Number(e.target.value))} className={field}>
            {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => (
              <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
            ))}
          </select>
        </label>
        <div>
          <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("cal.planDays")}</span>
          <div className="flex flex-wrap gap-2">
            {order.map((d, i) => {
              const on = days.includes(d);
              return (
                <button key={d} aria-pressed={on} onClick={() => setDays((cur) => (on ? cur.filter((x) => x !== d) : [...cur, d]))} className={`w-11 h-9 rounded-lg text-[13px] font-medium border transition-colors ${on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}>
                  {names[i]}
                </button>
              );
            })}
          </div>
        </div>
        <label className="block">
          <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("cal.planWeeks")}</span>
          <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className={field}>
            {[1, 2, 3, 4, 6, 8, 12].map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-5">
        <button onClick={onClose} className="px-4 h-10 rounded-xl border border-border text-sm text-foreground hover:bg-secondary">{t("common.cancel")}</button>
        <button onClick={go} disabled={busy || days.length === 0} className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60">
          <Sparkles size={15} /> {t("cal.planGo")}
        </button>
      </div>
    </Modal>
  );
}

/** A month at a glance, the day's agenda beside it, and a planner that spreads the path over the weeks. */
export function CalendarScreen() {
  const { t, lang } = useI18n();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(today);
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);
  const [planning, setPlanning] = useState(false);
  const [missed, setMissed] = useState(0);
  useEffect(() => {
    api.getMissed().then(setMissed).catch(() => undefined);
  }, [events]);
  const reschedule = async () => {
    const r = await api.reschedule();
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    toast.success(t("cal.rescheduled", { n: r.moved }));
    setMissed(0);
    load();
  };

  const grid = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const load = useCallback(() => {
    const from = grid[0]!;
    const to = new Date(grid[41]!.getTime() + 86_400_000);
    api.getCalendar(from, to).then((e) => (setEvents(e), setFailed(false))).catch(() => (setFailed(true), setEvents((e) => e ?? [])));
  }, [grid]);
  useEffect(load, [load]);

  const byDay = useMemo(() => groupByDay(events ?? []), [events]);
  const dayEvents = byDay.get(dayKey(selected)) ?? [];
  const names = t("cal.dayNames").split(",");
  const monthLabel = cursor.toLocaleDateString(dateLocale(lang), { month: "long", year: "numeric" });
  const time = (iso: string) => new Date(iso).toLocaleTimeString(dateLocale(lang), { hour: "2-digit", minute: "2-digit" });

  const move = (delta: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  const goToday = () => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  };

  const toggleDone = async (e: CalendarEvent) => {
    const res = await api.updateEvent(e.id, { done: !e.done });
    if (!res.success) return void toast.error(res.error || t("admin.error"));
    load();
  };
  const remove = async (e: CalendarEvent) => {
    const res = await api.deleteEvent(e.id);
    if (!res.success) return void toast.error(res.error || t("admin.error"));
    toast.success(t("cal.deleted"));
    load();
  };
  const exportIcs = async () => {
    if (!(await api.downloadCalendar())) toast.error(t("cal.exportFailed"));
  };

  const btn = "inline-flex items-center justify-center gap-2 px-3.5 h-10 rounded-xl text-[13px] font-medium transition-colors";
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-8 py-5 pb-16">
        {/* Everything you can do sits in one bar on top, centred over the calendar. */}
        <div className="flex flex-col items-center gap-4 mb-5">
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => move(-1)} aria-label={t("cal.prev")} className="w-10 h-10 rounded-xl flex items-center justify-center border border-border text-foreground hover:bg-secondary"><ChevronLeft size={18} /></button>
            <h1 className="min-w-[12rem] sm:min-w-[16rem] text-center text-2xl sm:text-3xl font-bold tracking-tight text-foreground capitalize">{monthLabel}</h1>
            <button onClick={() => move(1)} aria-label={t("cal.next")} className="w-10 h-10 rounded-xl flex items-center justify-center border border-border text-foreground hover:bg-secondary"><ChevronRight size={18} /></button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button onClick={goToday} className={`${btn} border border-border text-foreground hover:bg-secondary`}>{t("cal.today")}</button>
            <button onClick={() => setEditing("new")} className={`${btn} bg-primary text-white font-semibold shadow-md shadow-primary/25`}>
              <Plus size={16} /> {t("cal.add")}
            </button>
            <button onClick={() => setPlanning(true)} className={`${btn} border border-primary/40 text-primary hover:bg-primary/10`}>
              <Sparkles size={16} /> {t("cal.plan")}
            </button>
            <button onClick={exportIcs} className={`${btn} border border-border text-foreground hover:bg-secondary`}>
              <Download size={16} /> {t("cal.export")}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground" aria-hidden>
            {KINDS.map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${KIND_STYLE[k].dot}`} />{t(`cal.kind.${k}` as Keys)}</span>
            ))}
          </div>
        </div>

        {missed > 0 && (
          <div role="status" className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center gap-3">
            <p className="flex-1 min-w-[200px] text-[13.5px] text-foreground">{t("cal.missed", { n: missed })}</p>
            <button onClick={reschedule} className="px-4 h-9 rounded-lg bg-primary text-white text-[13px] font-semibold">{t("cal.reschedule")}</button>
          </div>
        )}

        <section className="rounded-2xl border border-border bg-card p-2 sm:p-4">
          <div className="grid grid-cols-7 text-center text-[11px] sm:text-xs font-mono uppercase tracking-wide text-muted-foreground mb-1">
            {names.map((n) => <div key={n} className="py-1.5">{n}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden bg-border border border-border">
            {grid.map((d) => {
              const list = byDay.get(dayKey(d)) ?? [];
              const inMonth = d.getMonth() === cursor.getMonth();
              const isSel = sameDay(d, selected);
              const isToday = sameDay(d, today);
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setSelected(d)}
                  aria-label={d.toLocaleDateString(dateLocale(lang), { weekday: "long", day: "numeric", month: "long" }) + (list.length ? ` – ${list.length}` : "")}
                  aria-pressed={isSel}
                  className={`min-h-[56px] sm:min-h-[118px] p-1.5 sm:p-2 text-left flex flex-col items-stretch transition-colors ${inMonth ? "bg-card" : "bg-secondary"} ${isSel ? "ring-2 ring-inset ring-primary" : "hover:bg-secondary"}`}
                >
                  <span className={`self-start w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[12px] sm:text-[13px] ${isToday ? "bg-primary text-white font-bold" : inMonth ? "text-foreground" : "text-muted-foreground"}`}>{d.getDate()}</span>
                  <span className="hidden sm:flex flex-col gap-1 mt-1.5">
                    {list.slice(0, 3).map((e) => (
                      <span key={e.id} className={`truncate rounded px-1.5 py-0.5 text-[12px] leading-tight ${KIND_STYLE[e.kind].chip} ${e.done ? "line-through opacity-60" : ""}`}>{e.title}</span>
                    ))}
                    {list.length > 3 && <span className="text-[11px] text-muted-foreground px-1">{t("cal.more", { n: list.length - 3 })}</span>}
                  </span>
                  <span className="flex sm:hidden gap-0.5 mt-1 flex-wrap">
                    {list.slice(0, 4).map((e) => <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${KIND_STYLE[e.kind].dot}`} />)}
                  </span>
                </button>
              );
            })}
          </div>
          {failed && <p role="alert" className="mt-3 text-sm text-destructive">{t("cal.loadError")}</p>}
        </section>

        {/* The selected day, under the calendar and as wide as it. */}
        <section className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-live="polite">
          <h2 className="text-[16px] font-semibold text-foreground capitalize text-center sm:text-left">
            {selected.toLocaleDateString(dateLocale(lang), { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          {events === null ? (
            <div className="space-y-2 mt-3">{[0, 1].map((i) => <div key={i} className="h-14 rounded-xl bg-secondary animate-pulse" />)}</div>
          ) : dayEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-3 text-center sm:text-left">{t("cal.nothing")}</p>
          ) : (
            <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {dayEvents.map((e) => (
                <li key={e.id} className={`rounded-xl border border-border p-3 ${e.done ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-2.5">
                    {(e.kind === "study" || e.stepId) && e.source !== "school" ? (
                      <button onClick={() => toggleDone(e)} aria-pressed={e.done} aria-label={e.done ? t("cal.markUndone") : t("cal.markDone")} className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${e.done ? "bg-primary border-primary text-white" : "border-border hover:border-primary text-transparent"}`}>
                        <Check size={12} strokeWidth={3} />
                      </button>
                    ) : (
                      <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${KIND_STYLE[e.kind].dot}`} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-[14px] font-medium text-foreground leading-snug ${e.done ? "line-through" : ""}`}>{e.title}</p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        {time(e.startsAt)} – {time(e.endsAt)} · {t(`cal.kind.${e.kind}` as Keys)}
                      </p>
                      {e.notes && <p className="text-[12.5px] text-muted-foreground mt-1.5 whitespace-pre-wrap break-words">{e.notes}</p>}
                    </div>
                  </div>
                  {e.source === "school" ? (
                    <p className="mt-2 text-[11.5px] text-muted-foreground text-right">{t("cal.fromSchool", { school: e.schoolName ?? "" })}</p>
                  ) : (
                  <div className="flex justify-end gap-1 mt-2">
                    {e.contentUrl && (
                      <a href={e.contentUrl} target="_blank" rel="noopener noreferrer" aria-label={t("cal.open")} title={t("cal.open")} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary">
                        <ExternalLink size={15} />
                      </a>
                    )}
                    <button onClick={() => setEditing(e)} aria-label={t("school.edit")} title={t("school.edit")} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"><Pencil size={15} /></button>
                    <button onClick={() => remove(e)} aria-label={t("cal.delete")} title={t("cal.delete")} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary"><Trash2 size={15} /></button>
                  </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {editing && <EventDialog event={editing === "new" ? null : editing} day={selected} onClose={() => setEditing(null)} onSaved={load} />}
      {planning && <PlanDialog onClose={() => setPlanning(false)} onPlanned={load} />}
    </div>
  );
}
