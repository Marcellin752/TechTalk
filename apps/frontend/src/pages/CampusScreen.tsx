import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, Flag, GraduationCap, MapPin, Plus, ThumbsUp, Trash2, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { api, CampusMe, CampusOverview, CampusPerson, CampusProgramme, CampusResource, CampusSession, ResourceKind } from "../services/api";
import { Modal } from "../components/Modal";
import { dateLocale, useI18n } from "../lib/i18n";
import { fromInputs, toDateInput, toTimeInput } from "../lib/calendar";
import { ROUTES } from "../lib/routes";
import type { Keys } from "../locales/en";

type Tab = "programme" | "revisions" | "exams" | "people";
const TABS: Tab[] = ["programme", "revisions", "exams", "people"];
const KINDS: ResourceKind[] = ["exam", "correction", "td", "notes", "cheatsheet"];
const LOOKING = ["study-buddy", "mentor", "mentee", "team"] as const;
const field = "w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary";
const btnPrimary = "inline-flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold shadow-md shadow-primary/25 disabled:opacity-60";
const btnOutline = "inline-flex items-center justify-center gap-2 px-3.5 h-9 rounded-lg border border-border text-[13px] font-medium text-foreground hover:bg-secondary disabled:opacity-60";

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1.5">{text}</span>
      {children}
    </label>
  );
}

/* ------------------------------ programme ------------------------------ */

const KIND_LABEL: Record<string, Keys> = { piscine: "campus.pkind.piscine", project: "campus.pkind.project", module: "campus.pkind.module", internship: "campus.pkind.internship" };

/** The school's programme: each year's projects and the skills they build, and how far you are. */
function Programme({ onChanged }: { onChanged: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [data, setData] = useState<CampusProgramme | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.campusProgramme().then((r) => {
      if (!r.success || !r.data) return setData({ school: { name: "" }, myYear: null, status: null, years: [] });
      setData(r.data);
      setYear((y) => y ?? r.data!.years.find((x) => x.year === r.data!.myYear)?.year ?? r.data!.years[0]?.year ?? null);
    });
  }, []);
  useEffect(load, [load]);

  if (!data) return <div className="h-40 rounded-2xl bg-secondary animate-pulse" />;
  if (data.years.length === 0) return <p className="text-sm text-muted-foreground text-center py-12">{t("campus.programme.none")}</p>;
  const y = data.years.find((x) => x.year === year) ?? data.years[0]!;

  const follow = async () => {
    setBusy(true);
    const r = await api.createPath({ kind: "school", schoolYear: y.year });
    setBusy(false);
    if (!r.success || !r.path) return void toast.error(r.error || t("admin.error"));
    toast.success(t("paths.created"));
    load();
    onChanged();
    navigate(`${ROUTES.path}?p=${r.path.id}`);
  };

  return (
    <div>
      {data.status !== "confirmed" && <p className="mb-4 text-[12.5px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 leading-relaxed">{t("paths.draftNote")}</p>}

      <div role="tablist" aria-label={t("school.year")} className="flex flex-wrap justify-center gap-2 mb-6">
        {data.years.map((x) => (
          <button key={x.year} role="tab" aria-selected={y.year === x.year} onClick={() => setYear(x.year)} className={`px-4 h-9 rounded-full text-[13px] font-medium border transition-colors ${y.year === x.year ? "bg-primary text-white border-primary" : "border-border text-foreground hover:bg-secondary"}`}>
            {t("campus.yearN", { n: x.year })}{x.year === data.myYear ? " ★" : ""}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground">{y.title}</h2>
            {y.summary && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{y.summary}</p>}
            <p className="text-[12.5px] text-muted-foreground mt-2">{t("campus.programme.counts", { n: y.projects.length, hours: y.hours })}</p>
          </div>
          {y.path ? (
            <Link to={`${ROUTES.path}?p=${y.path.id}`} className={btnPrimary}>{t("campus.programme.openPath", { n: y.path.percent })}</Link>
          ) : (
            <button onClick={follow} disabled={busy} className={btnPrimary}><GraduationCap size={16} /> {t("campus.programme.follow")}</button>
          )}
        </div>
        <div className="mt-5">
          <h3 className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2">{t("campus.programme.skills")}</h3>
          <div className="flex flex-wrap gap-1.5">{y.skills.map((s) => <span key={s} className="px-2.5 h-7 inline-flex items-center rounded-full bg-primary/10 text-primary text-[13px]">{s}</span>)}</div>
        </div>
      </section>

      <ol className="mt-5 grid gap-4 md:grid-cols-2">
        {y.projects.map((p) => {
          const pct = p.progress && p.progress.total ? Math.round((p.progress.done / p.progress.total) * 100) : null;
          return (
            <li key={p.name} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <h3 className="min-w-0 flex-1 text-[16px] font-semibold text-foreground leading-snug">{p.name}</h3>
                <span className="px-2 py-0.5 rounded bg-secondary text-[11px] font-semibold text-muted-foreground flex-shrink-0">{t(KIND_LABEL[p.kind] ?? "campus.pkind.project")}</span>
              </div>
              {p.summary && <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">{p.summary}</p>}
              <div className="flex flex-wrap gap-1.5 mt-3">{p.topics.map((tp) => <span key={tp} className="px-2 h-6 inline-flex items-center rounded-full bg-secondary text-[12px] font-mono text-foreground">{tp}</span>)}</div>
              <div className="flex items-center gap-3 mt-3 text-[12px] text-muted-foreground">
                {p.hours && <span>{t("campus.programme.hours", { n: p.hours })}</span>}
                {pct !== null && p.progress && (
                  <span className="ml-auto flex items-center gap-2">
                    <span className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden"><span className="block h-full bg-primary" style={{ width: `${pct}%` }} /></span>
                    {t("path.doneOf", { done: p.progress.done, total: p.progress.total })}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------ revisions ------------------------------ */

function SessionDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const soon = new Date(Date.now() + 86_400_000);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(toDateInput(soon));
  const [from, setFrom] = useState("18:00");
  const [to, setTo] = useState("20:00");
  const [place, setPlace] = useState("");
  const [online, setOnline] = useState("");
  const [capacity, setCapacity] = useState(8);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const startsAt = fromInputs(date, from);
    const endsAt = fromInputs(date, to);
    if (!startsAt || !endsAt) return void toast.error(t("cal.badTimes"));
    setBusy(true);
    const r = await api.campusAddSession({ title, subject, description, place, onlineUrl: online || null, capacity, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
    setBusy(false);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    toast.success(t("campus.sessionCreated"));
    onSaved();
    onClose();
  };

  return (
    <Modal title={t("campus.newSession")} onClose={onClose} wide>
      <div className="px-5 py-4 space-y-3">
        <Label text={t("cal.eventTitle")}><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("campus.sessionTitlePh")} className={field} autoFocus /></Label>
        <Label text={t("campus.subject")}><input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={80} placeholder={t("campus.subjectPh")} className={field} /></Label>
        <div className="grid grid-cols-3 gap-3">
          <Label text={t("cal.date")}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></Label>
          <Label text={t("cal.start")}><input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={field} /></Label>
          <Label text={t("cal.end")}><input type="time" value={to} onChange={(e) => setTo(e.target.value)} className={field} /></Label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Label text={t("campus.place")}><input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={120} placeholder={t("campus.placePh")} className={field} /></Label>
          <Label text={t("campus.online")}><input value={online} onChange={(e) => setOnline(e.target.value)} type="url" placeholder="https://…" className={field} /></Label>
        </div>
        <Label text={t("campus.capacity")}>
          <input type="number" min={2} max={50} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className={field} />
        </Label>
        <Label text={t("cal.notes")}><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} className={`${field} resize-none`} /></Label>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-5">
        <button onClick={onClose} className={btnOutline}>{t("common.cancel")}</button>
        <button onClick={save} disabled={busy} className={btnPrimary}>{t("campus.organise")}</button>
      </div>
    </Modal>
  );
}

function Revisions({ reloadOverview }: { reloadOverview: () => void }) {
  const { t, lang } = useI18n();
  const [list, setList] = useState<CampusSession[] | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api.campusSessions().then((r) => setList(r.success ? r.data!.sessions : []));
  }, []);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<{ success: boolean; error?: string }>, ok?: string) => {
    const r = await fn();
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    if (ok) toast.success(ok);
    load();
    reloadOverview();
  };
  const day = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(lang), { weekday: "long", day: "numeric", month: "long" });
  const time = (iso: string) => new Date(iso).toLocaleTimeString(dateLocale(lang), { hour: "2-digit", minute: "2-digit" });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <p className="text-sm text-muted-foreground flex-1 min-w-[220px] leading-relaxed">{t("campus.revisions.intro")}</p>
        <button onClick={() => setCreating(true)} className={btnPrimary}><Plus size={16} /> {t("campus.newSession")}</button>
      </div>
      {list === null ? <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-28 rounded-2xl bg-secondary animate-pulse" />)}</div> : list.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">{t("campus.revisions.none")}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.map((s) => (
            <li key={s.id} className={`rounded-2xl border bg-card p-4 sm:p-5 ${s.joined ? "border-primary/50" : "border-border"}`}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <span className="inline-block px-2 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-semibold">{s.subject}</span>
                  <h3 className="text-[16px] font-semibold text-foreground mt-1.5 leading-snug">{s.title}</h3>
                  <p className="text-[13px] text-foreground mt-1 capitalize">{day(s.startsAt)} · {time(s.startsAt)}–{time(s.endsAt)}</p>
                </div>
                <span className={`text-[12px] font-mono px-2 py-1 rounded-lg ${s.full ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"}`} title={t("campus.seats")}>{s.members}/{s.capacity}</span>
              </div>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground mt-2">
                {s.place && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {s.place}</span>}
                {s.onlineUrl && s.joined && <a href={s.onlineUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Video size={13} /> {t("campus.joinOnline")}</a>}
                {s.onlineUrl && !s.joined && <span className="inline-flex items-center gap-1"><Video size={13} /> {t("campus.onlineAfterJoin")}</span>}
              </p>
              {s.description && <p className="text-[13px] text-muted-foreground mt-2 whitespace-pre-wrap break-words">{s.description}</p>}
              <div className="flex items-center gap-3 mt-4">
                <span className="text-[12px] text-muted-foreground mr-auto">{t("campus.hostedBy", { name: s.mine ? t("admin.user.you") : s.hostName })}</span>
                {s.mine ? (
                  <button onClick={() => window.confirm(t("campus.cancelConfirm")) && act(() => api.campusCancel(s.id), t("cal.deleted"))} className={`${btnOutline} text-destructive border-destructive/40`}><Trash2 size={14} /> {t("campus.cancel")}</button>
                ) : s.joined ? (
                  <button onClick={() => act(() => api.campusLeave(s.id))} className={btnOutline}>{t("campus.leave")}</button>
                ) : (
                  <button onClick={() => act(() => api.campusJoin(s.id), t("campus.joined"))} disabled={s.full} className={btnPrimary.replace("h-10", "h-9").replace("text-sm", "text-[13px]")}>{s.full ? t("campus.full") : t("campus.join")}</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {creating && <SessionDialog onClose={() => setCreating(false)} onSaved={() => (load(), reloadOverview())} />}
    </div>
  );
}

/* ------------------------------ past exams ------------------------------ */

function ResourceDialog({ subjects, onClose, onSaved }: { subjects: string[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ title: "", kind: "exam" as ResourceKind, subject: "", year: "", studyYear: "", url: "", description: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setBusy(true);
    const r = await api.campusAddResource({ ...form, year: form.year || null, studyYear: form.studyYear || null });
    setBusy(false);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    toast.success(t("campus.shared"));
    onSaved();
    onClose();
  };

  return (
    <Modal title={t("campus.addExam")} onClose={onClose} wide>
      <div className="px-5 py-4 space-y-3">
        <p className="text-[12.5px] text-muted-foreground leading-relaxed">{t("campus.linkOnly")}</p>
        <Label text={t("cal.eventTitle")}><input value={form.title} onChange={set("title")} maxLength={140} className={field} autoFocus /></Label>
        <div className="grid sm:grid-cols-2 gap-3">
          <Label text={t("cal.kind")}>
            <select value={form.kind} onChange={set("kind")} className={field}>{KINDS.map((k) => <option key={k} value={k}>{t(`campus.kind.${k}` as Keys)}</option>)}</select>
          </Label>
          <Label text={t("campus.subject")}>
            <input value={form.subject} onChange={set("subject")} list="campus-subjects" maxLength={80} className={field} />
            <datalist id="campus-subjects">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
          </Label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Label text={t("campus.examYear")}><input type="number" value={form.year} onChange={set("year")} placeholder="2025" className={field} /></Label>
          <Label text={t("school.year")}><input type="number" min={1} max={8} value={form.studyYear} onChange={set("studyYear")} className={field} /></Label>
        </div>
        <Label text={t("campus.link")}><input value={form.url} onChange={set("url")} type="url" placeholder="https://…" className={field} /></Label>
        <Label text={t("cal.notes")}><textarea value={form.description} onChange={set("description")} maxLength={500} rows={2} className={`${field} resize-none`} /></Label>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-5">
        <button onClick={onClose} className={btnOutline}>{t("common.cancel")}</button>
        <button onClick={save} disabled={busy} className={btnPrimary}>{t("campus.share")}</button>
      </div>
    </Modal>
  );
}

function Exams({ reloadOverview }: { reloadOverview: () => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState("");
  const [rows, setRows] = useState<CampusResource[] | null>(null);
  const [total, setTotal] = useState(0);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.campusResources({ q, subject, kind }).then((r) => {
      if (!r.success || !r.data) return setRows([]);
      setRows(r.data.resources);
      setTotal(r.data.total);
      setSubjects(r.data.subjects);
    });
  }, [q, subject, kind]);
  useEffect(() => {
    const id = window.setTimeout(load, 250);
    return () => window.clearTimeout(id);
  }, [load]);

  const vote = async (r: CampusResource) => {
    const res = await api.campusVote(r.id);
    if (!res.success || !res.data) return void toast.error(res.error || t("admin.error"));
    setRows((cur) => (cur ?? []).map((x) => (x.id === r.id ? { ...x, voted: res.data!.voted, votes: res.data!.votes } : x)));
  };
  const report = async (r: CampusResource) => {
    if (!window.confirm(t("campus.reportConfirm"))) return;
    const res = await api.campusReport(r.id);
    toast[res.success ? "success" : "error"](res.success ? t("campus.reported") : res.error || t("admin.error"));
  };
  const remove = async (r: CampusResource) => {
    if (!window.confirm(t("campus.deleteConfirm"))) return;
    const res = await api.campusDeleteResource(r.id);
    if (!res.success) return void toast.error(res.error || t("admin.error"));
    setRows((cur) => (cur ?? []).filter((x) => x.id !== r.id));
    reloadOverview();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("admin.search")} aria-label={t("admin.search")} className={`${field} flex-1 min-w-[160px] !h-10`} />
        <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label={t("campus.subject")} className={`${field} !w-auto !h-10`}>
          <option value="">{t("campus.allSubjects")}</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t("cal.kind")} className={`${field} !w-auto !h-10`}>
          <option value="">{t("admin.content.all")}</option>
          {KINDS.map((k) => <option key={k} value={k}>{t(`campus.kind.${k}` as Keys)}</option>)}
        </select>
        <button onClick={() => setAdding(true)} className={btnPrimary}><Plus size={16} /> {t("campus.addExam")}</button>
      </div>

      {rows === null ? <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-secondary animate-pulse" />)}</div> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">{t("campus.exams.none")}</p>
      ) : (
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="p-4 flex items-start gap-3">
              <button onClick={() => vote(r)} aria-pressed={r.voted} aria-label={t("campus.useful")} title={t("campus.useful")} className={`flex flex-col items-center justify-center w-12 h-14 rounded-xl border flex-shrink-0 transition-colors ${r.voted ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                <ThumbsUp size={16} />
                <span className="text-[12px] font-mono tabular-nums mt-0.5">{r.votes}</span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">{t(`campus.kind.${r.kind}` as Keys)}</span>
                  <span className="px-2 py-0.5 rounded bg-secondary text-foreground">{r.subject}</span>
                  {r.year && <span className="text-muted-foreground font-mono">{r.year}</span>}
                  {r.studyYear && <span className="text-muted-foreground">{t("campus.yearN", { n: r.studyYear })}</span>}
                  {r.official && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold"><GraduationCap size={11} /> {t("campus.official")}</span>}
                </div>
                <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-start gap-1.5 text-[15px] font-medium text-foreground hover:text-primary mt-1 break-words">
                  {r.title} <ExternalLink size={13} className="mt-1.5 flex-shrink-0" />
                </a>
                {r.description && <p className="text-[13px] text-muted-foreground mt-1 whitespace-pre-wrap break-words">{r.description}</p>}
              </div>
              <div className="flex gap-0.5 flex-shrink-0">
                {r.mine ? (
                  <button onClick={() => remove(r)} aria-label={t("cal.delete")} title={t("cal.delete")} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary"><Trash2 size={15} /></button>
                ) : (
                  <button onClick={() => report(r)} aria-label={t("campus.report")} title={t("campus.report")} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary"><Flag size={15} /></button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows && rows.length > 0 && <p className="text-[12px] text-muted-foreground mt-3">{t("admin.total", { n: total })}</p>}
      {adding && <ResourceDialog subjects={subjects} onClose={() => setAdding(false)} onSaved={() => (load(), reloadOverview())} />}
    </div>
  );
}

/* ------------------------------ people ------------------------------ */

function MyVisibility({ me, onSaved }: { me: CampusMe; onSaved: () => void }) {
  const { t } = useI18n();
  const [discoverable, setDiscoverable] = useState(me.discoverable);
  const [headline, setHeadline] = useState(me.headline ?? "");
  const [lookingFor, setLookingFor] = useState<CampusMe["lookingFor"]>(me.lookingFor);
  const [contact, setContact] = useState(me.contact ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const r = await api.campusUpdateMe({ discoverable, headline: headline || null, lookingFor, contact: contact || null });
    setBusy(false);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    toast.success(t("cal.saved"));
    onSaved();
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 mb-6">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-foreground">{t("campus.visibility.title")}</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{t("campus.visibility.text")}</p>
        </div>
        <button role="switch" aria-checked={discoverable} aria-label={t("campus.visibility.title")} onClick={() => setDiscoverable((v) => !v)} className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${discoverable ? "bg-primary" : "bg-switch-background"}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${discoverable ? "translate-x-5" : ""}`} />
        </button>
      </div>
      {discoverable && (
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          <Label text={t("campus.headline")}><input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120} placeholder={t("campus.headlinePh")} className={field} /></Label>
          <Label text={t("campus.lookingFor")}>
            <select value={lookingFor ?? ""} onChange={(e) => setLookingFor((e.target.value || null) as CampusMe["lookingFor"])} className={field}>
              <option value="">–</option>
              {LOOKING.map((l) => <option key={l} value={l}>{t(`campus.looking.${l}` as Keys)}</option>)}
            </select>
          </Label>
          <Label text={t("campus.contact")}><input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={60} placeholder="@alex#1234" className={field} /></Label>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 mt-4">
        <p className="text-[12px] text-muted-foreground">{t("campus.visibility.note")}</p>
        <button onClick={save} disabled={busy} className={btnPrimary}>{t("common.save")}</button>
      </div>
    </section>
  );
}

function People({ me, reloadOverview }: { me: CampusMe; reloadOverview: () => void }) {
  const { t } = useI18n();
  const [people, setPeople] = useState<CampusPerson[] | null>(null);
  const [year, setYear] = useState("");
  const [lookingFor, setLookingFor] = useState("");

  const load = useCallback(() => {
    api.campusPeople({ year, lookingFor }).then((r) => setPeople(r.success ? r.data!.people : []));
  }, [year, lookingFor]);
  useEffect(load, [load]);

  return (
    <div>
      <MyVisibility me={me} onSaved={() => (load(), reloadOverview())} />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 className="text-[15px] font-semibold text-foreground mr-auto">{t("campus.people.title")}</h3>
        <select value={year} onChange={(e) => setYear(e.target.value)} aria-label={t("school.year")} className={`${field} !w-auto !h-10`}>
          <option value="">{t("campus.allYears")}</option>
          {Array.from({ length: 5 }, (_, i) => i + 1).map((y) => <option key={y} value={y}>{t("campus.yearN", { n: y })}</option>)}
        </select>
        <select value={lookingFor} onChange={(e) => setLookingFor(e.target.value)} aria-label={t("campus.lookingFor")} className={`${field} !w-auto !h-10`}>
          <option value="">{t("campus.anyone")}</option>
          {LOOKING.map((l) => <option key={l} value={l}>{t(`campus.looking.${l}` as Keys)}</option>)}
        </select>
      </div>
      {people === null ? <div className="h-28 rounded-2xl bg-secondary animate-pulse" /> : people.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">{t("campus.people.none")}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {people.map((p) => (
            <li key={p.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                {p.picture ? <img src={p.picture} alt="" className="w-11 h-11 rounded-full object-cover" /> : <span className="w-11 h-11 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center">{p.name.slice(0, 1).toUpperCase()}</span>}
                <div className="min-w-0">
                  {p.handle ? <Link to={`/u/${p.handle}`} className="font-semibold text-foreground hover:text-primary truncate block">{p.name}</Link> : <span className="font-semibold text-foreground truncate block">{p.name}</span>}
                  <span className="text-[12px] text-muted-foreground">{p.year ? t("campus.yearN", { n: p.year }) : ""}{p.year && p.lookingFor ? " · " : ""}{p.lookingFor ? `${t("campus.lookingFor")}: ${t(`campus.looking.${p.lookingFor}` as Keys)}` : ""}</span>
                </div>
              </div>
              {p.headline && <p className="text-[13px] text-foreground mt-3 leading-relaxed">{p.headline}</p>}
              {p.shared.length > 0 && (
                <div className="mt-3">
                  <span className="text-[11px] text-muted-foreground">{t("campus.inCommon", { n: p.shared.length })}</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">{p.shared.map((s) => <span key={s} className="px-2 h-6 inline-flex items-center rounded-full bg-primary/10 text-primary text-[12px]">{s}</span>)}</div>
                </div>
              )}
              {p.contact && <p className="text-[12px] text-muted-foreground mt-3 font-mono break-all">{p.contact}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------ page ------------------------------ */

/** The campus of the learner's school: revise together, find past exams, meet people. */
export function CampusScreen() {
  const { t } = useI18n();
  const [overview, setOverview] = useState<CampusOverview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "no_school" | "error">("loading");
  const [tab, setTab] = useState<Tab>("programme");

  const load = useCallback(() => {
    api.campusOverview().then((r) => {
      if (r.success && r.data) (setOverview(r.data), setState("ready"));
      else setState(r.status === 403 ? "no_school" : "error");
    });
  }, []);
  useEffect(load, [load]);

  const counts = overview?.counts;
  const badge = useMemo(() => ({ programme: undefined as number | undefined, revisions: counts?.sessions, exams: counts?.resources, people: counts?.people }), [counts]);

  if (state === "no_school") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6 py-16">
        <span className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><Users size={26} /></span>
        <h1 className="text-2xl font-bold text-foreground">{t("campus.locked.title")}</h1>
        <p className="text-muted-foreground max-w-md leading-relaxed">{t("campus.locked.text")}</p>
        <Link to={ROUTES.path} className={`${btnPrimary} mt-2`}>{t("campus.locked.cta")}</Link>
      </div>
    );
  }
  if (state === "error") return <p role="alert" className="p-8 text-center text-destructive">{t("admin.error")}</p>;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-16">
        <div className="text-center mb-6">
          <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-primary">{t("nav.campus")}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">{overview?.school.name ?? "…"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("campus.subtitle")}</p>
        </div>

        <div role="tablist" className="flex justify-center gap-1 mb-6 border-b border-border">
          {TABS.map((x) => (
            <button key={x} role="tab" aria-selected={tab === x} onClick={() => setTab(x)} className={`px-4 sm:px-6 h-11 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === x ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t(`campus.tab.${x}` as Keys)}
              {badge[x] != null && <span className="ml-2 text-[11px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{badge[x]}</span>}
            </button>
          ))}
        </div>

        {state === "loading" ? <div className="h-40 rounded-2xl bg-secondary animate-pulse" /> : (
          <>
            {tab === "programme" && <Programme onChanged={load} />}
            {tab === "revisions" && <Revisions reloadOverview={load} />}
            {tab === "exams" && <Exams reloadOverview={load} />}
            {tab === "people" && overview && <People me={overview.me} reloadOverview={load} />}
          </>
        )}
      </div>
    </div>
  );
}
