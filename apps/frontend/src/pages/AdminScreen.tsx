import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, KeyRound, Loader2, Plus, RefreshCw, Search, ShieldCheck, Trash2, UserX } from "lucide-react";
import { toast } from "sonner";
import { api, AdminCampusResource, AdminComment, AdminContent, AdminSchool, AdminStats, AdminUser, User } from "../services/api";
import { dateLocale, useI18n } from "../lib/i18n";

type Tab = "overview" | "users" | "moderation" | "content" | "schools";
const TABS: Tab[] = ["overview", "users", "schools", "moderation", "content"];
const PAGE = 20;
const input = "h-10 rounded-xl bg-secondary border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary";

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="relative flex-1 min-w-[200px]">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={label} aria-label={label} className={`${input} w-full pl-9`} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</div>
      <div className="text-[12px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function Overview() {
  const { t, lang } = useI18n();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    api.adminStats().then((r) => (r.success ? (setStats(r.data!), setError(false)) : setError(true)));
  }, []);
  useEffect(load, [load]);

  // While a collection runs, look again every few seconds.
  const running = stats?.sync.running;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(load, 4000);
    return () => window.clearInterval(id);
  }, [running, load]);

  const sync = async () => {
    const r = await api.adminSync();
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    toast.success(t("admin.sync.started"));
    load();
  };

  if (error) return <p role="alert" className="text-sm text-destructive">{t("admin.error")}</p>;
  if (!stats) return <Loader2 className="animate-spin text-primary" />;
  const when = (iso: string) => new Date(iso).toLocaleString(dateLocale(lang), { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={t("admin.stat.users")} value={stats.users.total} />
        <Stat label={t("admin.stat.week")} value={stats.users.lastWeek} />
        <Stat label={t("admin.stat.admins")} value={stats.users.admins} />
        <Stat label={t("admin.stat.public")} value={stats.users.publicProfiles} />
        <Stat label={t("admin.stat.sessions")} value={stats.users.activeSessions} />
        <Stat label={t("admin.stat.paths")} value={stats.activity.activePaths} />
        <Stat label={t("admin.stat.comments")} value={stats.activity.comments} />
        <Stat label={t("admin.stat.content")} value={stats.content.total} />
        <Stat label={t("admin.stat.kairos24")} value={stats.activity.kairosMessages24h} />
        <Stat label={t("admin.stat.kairos7")} value={stats.activity.kairosMessages7d} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-foreground">{t("admin.sync.title")}</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">{t("admin.sync.text")}</p>
          <p className="text-[12px] text-muted-foreground mt-1.5">
            {stats.sync.running ? t("admin.sync.running") : stats.sync.finishedAt ? t("admin.sync.last", { when: when(stats.sync.finishedAt) }) : t("admin.sync.never")}
            {stats.sync.lastError && <span className="text-destructive"> · {stats.sync.lastError}</span>}
          </p>
        </div>
        <button onClick={sync} disabled={stats.sync.running} className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60 flex-shrink-0">
          <RefreshCw size={15} className={stats.sync.running ? "animate-spin" : ""} /> {t("admin.sync.run")}
        </button>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-[15px] font-semibold text-foreground mb-3">{t("admin.byType")}</h2>
          <ul className="rounded-xl border border-border divide-y divide-border bg-card">
            {stats.content.byType.map((r) => (
              <li key={r.type} className="flex justify-between px-4 py-2.5 text-sm"><span className="text-foreground">{r.type}</span><span className="tabular-nums text-muted-foreground">{r.n}</span></li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-[15px] font-semibold text-foreground mb-3">{t("admin.bySource")}</h2>
          <ul className="rounded-xl border border-border divide-y divide-border bg-card">
            {stats.content.bySource.map((r) => (
              <li key={r.source} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="text-foreground truncate">{r.source}</span>
                <span className="text-muted-foreground text-right">
                  <span className="tabular-nums">{r.n}</span>
                  {r.latest && <span className="hidden sm:inline text-[12px]"> · {t("admin.latest")} {new Date(r.latest).toLocaleDateString(dateLocale(lang))}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h2 className="text-[15px] font-semibold text-foreground mb-3">{t("admin.audit")}</h2>
        {stats.audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.audit.none")}</p>
        ) : (
          <ul className="rounded-xl border border-border divide-y divide-border bg-card">
            {stats.audit.map((a) => (
              <li key={a.id} className="px-4 py-2.5 text-[13px] flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="font-mono text-primary">{a.action}</span>
                <span className="text-foreground truncate max-w-[260px]">{a.target}</span>
                <span className="text-muted-foreground ml-auto">{a.adminEmail} · {when(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** A paged list that loads the next page under the first. */
function usePaged<T>(fetchPage: (offset: number) => Promise<{ success: boolean; data?: { rows: T[]; total: number } }>, deps: unknown[]) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const r = await fetchPage(0);
    if (r.success && r.data) (setRows(r.data.rows), setTotal(r.data.total));
    else (setRows([]), setTotal(0), toast.error("Could not load."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    setRows(null);
    void reload();
  }, [reload]);

  const more = async () => {
    setBusy(true);
    const r = await fetchPage(rows?.length ?? 0);
    setBusy(false);
    if (r.success && r.data) (setRows((cur) => [...(cur ?? []), ...r.data!.rows]), setTotal(r.data.total));
  };
  return { rows, total, busy, more, reload, remove: (pred: (x: T) => boolean) => setRows((cur) => (cur ?? []).filter((x) => !pred(x))), patch: (fn: (x: T) => T) => setRows((cur) => (cur ?? []).map(fn)), setTotal };
}

function Footer({ shown, total, busy, onMore }: { shown: number; total: number; busy: boolean; onMore: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between mt-4 text-[13px] text-muted-foreground">
      <span>{t("admin.total", { n: total })}</span>
      {shown < total && <button onClick={onMore} disabled={busy} className="px-4 h-9 rounded-lg border border-border text-foreground hover:bg-secondary disabled:opacity-60">{t("admin.more")}</button>}
    </div>
  );
}

function Users({ me }: { me: User | null }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = usePaged<AdminUser>(async (offset) => {
    const r = await api.adminUsers(dq, offset);
    return { success: r.success, data: r.data && { rows: r.data.users, total: r.data.total } };
  }, [dq]);

  const act = async (u: AdminUser, kind: "role" | "signout" | "delete") => {
    const msg = kind === "delete" ? t("admin.user.confirmDelete", { name: u.name }) : kind === "signout" ? t("admin.user.confirmSignOut", { name: u.name }) : t("admin.user.confirmRole", { name: u.name });
    if (!window.confirm(msg)) return;
    const r = kind === "role" ? await api.adminSetRole(u.id, u.role === "admin" ? "user" : "admin") : kind === "signout" ? await api.adminSignOutUser(u.id) : await api.adminDeleteUser(u.id);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    toast.success(t("admin.user.done"));
    if (kind === "delete") (list.remove((x) => x.id === u.id), list.setTotal((n) => n - 1));
    else if (kind === "role") list.patch((x) => (x.id === u.id ? { ...x, role: u.role === "admin" ? "user" : "admin" } : x));
  };

  return (
    <div>
      <div className="flex gap-3 mb-4"><SearchBox value={q} onChange={setQ} label={t("admin.search")} /></div>
      {list.rows === null ? <Loader2 className="animate-spin text-primary" /> : list.rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("admin.user.none")}</p> : (
        <ul className="rounded-xl border border-border divide-y divide-border bg-card">
          {list.rows.map((u) => {
            const isMe = u.id === me?.id;
            return (
              <li key={u.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{u.name}</span>
                    {isMe && <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{t("admin.user.you")}</span>}
                    {u.ambassador && <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 font-semibold">{t("campus.ambassador")}</span>}
                    {u.role === "admin" && <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold"><ShieldCheck size={11} /> admin</span>}
                    {u.isPublic && u.handle && <Link to={`/u/${u.handle}`} className="text-[12px] text-primary hover:underline">@{u.handle}</Link>}
                  </div>
                  <p className="text-[13px] text-muted-foreground truncate">{u.email}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {t("admin.user.joined", { date: new Date(u.createdAt).toLocaleDateString(dateLocale(lang)) })}
                    {" · "}{[u.hasPassword && "email", u.google && "Google", u.github && "GitHub"].filter(Boolean).join(", ")}
                  </p>
                </div>
                {!isMe && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => act(u, "role")} className="px-3 h-8 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary">{u.role === "admin" ? t("admin.user.makeUser") : t("admin.user.makeAdmin")}</button>
                    <button onClick={async () => { const r = await api.adminSetAmbassador(u.id, !u.ambassador); if (!r.success) return void toast.error(r.error || t("admin.error")); list.patch((x) => (x.id === u.id ? { ...x, ambassador: !u.ambassador } : x)); }} className="px-3 h-8 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary">{u.ambassador ? t("admin.user.ambassadorOff") : t("admin.user.ambassadorOn")}</button>
                    <button onClick={() => act(u, "signout")} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary"><UserX size={14} /> {t("admin.user.signOut")}</button>
                    <button onClick={() => act(u, "delete")} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-destructive/40 text-[13px] text-destructive hover:bg-destructive/10"><Trash2 size={14} /> {t("admin.user.delete")}</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {list.rows && <Footer shown={list.rows.length} total={list.total} busy={list.busy} onMore={list.more} />}
    </div>
  );
}

/** Past exams and notes shared by students: the reported (hidden) ones first. */
function CampusModeration() {
  const { t } = useI18n();
  const [status, setStatus] = useState<"hidden" | "approved">("hidden");
  const list = usePaged<AdminCampusResource>(async (offset) => {
    const r = await api.adminCampusResources(status, offset);
    return { success: r.success, data: r.data && { rows: r.data.resources, total: r.data.total } };
  }, [status]);

  const setTo = async (c: AdminCampusResource, next: "approved" | "hidden") => {
    const r = await api.adminCampusSetStatus(c.id, next);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    list.remove((x) => x.id === c.id);
    list.setTotal((n) => n - 1);
  };
  const del = async (c: AdminCampusResource) => {
    if (!window.confirm(t("campus.deleteConfirm"))) return;
    const r = await api.adminCampusDelete(c.id);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    list.remove((x) => x.id === c.id);
    list.setTotal((n) => n - 1);
  };

  return (
    <section className="mt-10">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-[15px] font-semibold text-foreground mr-auto">{t("admin.campus.title")}</h2>
        <div role="radiogroup" className="flex rounded-lg border border-border bg-secondary p-0.5">
          {(["hidden", "approved"] as const).map((x) => (
            <button key={x} role="radio" aria-checked={status === x} onClick={() => setStatus(x)} className={`px-3 h-7 rounded-md text-[13px] font-medium ${status === x ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>{t(`admin.campus.${x}` as const)}</button>
          ))}
        </div>
      </div>
      {list.rows === null ? <Loader2 className="animate-spin text-primary" /> : list.rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("admin.campus.none")}</p> : (
        <ul className="rounded-xl border border-border divide-y divide-border bg-card">
          {list.rows.map((c) => (
            <li key={c.id} className="p-4 flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="text-sm font-medium text-foreground hover:text-primary break-words">{c.title}</a>
                <p className="text-[12px] text-muted-foreground mt-0.5">{c.school} · {c.subject} · {t("admin.campus.reports", { n: c.reports })} · {c.author ?? t("campus.official")}</p>
              </div>
              <div className="flex gap-2">
                {c.status === "hidden" ? <button onClick={() => setTo(c, "approved")} className="px-3 h-8 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary">{t("admin.campus.restore")}</button> : <button onClick={() => setTo(c, "hidden")} className="px-3 h-8 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary">{t("admin.campus.hide")}</button>}
                <button onClick={() => del(c)} aria-label={t("cal.delete")} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary"><Trash2 size={15} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Moderation() {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = usePaged<AdminComment>(async (offset) => {
    const r = await api.adminComments(dq, offset);
    return { success: r.success, data: r.data && { rows: r.data.comments, total: r.data.total } };
  }, [dq]);

  const del = async (c: AdminComment) => {
    if (!window.confirm(t("admin.comment.confirm"))) return;
    const r = await api.adminDeleteComment(c.id);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    list.remove((x) => x.id === c.id);
    list.setTotal((n) => n - 1);
  };

  return (
    <div>
      <div className="flex gap-3 mb-4"><SearchBox value={q} onChange={setQ} label={t("admin.search")} /></div>
      {list.rows === null ? <Loader2 className="animate-spin text-primary" /> : list.rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("admin.comment.none")}</p> : (
        <ul className="rounded-xl border border-border divide-y divide-border bg-card">
          {list.rows.map((c) => (
            <li key={c.id} className="p-4 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-muted-foreground">
                  <span className="text-foreground font-medium">{c.author.name}</span> ({c.author.email}) {t("admin.comment.on")} <span className="italic">{c.content.title}</span> · {new Date(c.createdAt).toLocaleString(dateLocale(lang))}
                </p>
                <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
              <button onClick={() => del(c)} aria-label={t("admin.comment.delete")} title={t("admin.comment.delete")} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary flex-shrink-0"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      {list.rows && <Footer shown={list.rows.length} total={list.total} busy={list.busy} onMore={list.more} />}
      <CampusModeration />
    </div>
  );
}

const CONTENT_TYPES = ["article", "video", "repo", "opportunity", "roadmap", "course", "doc", "paper", "exercise", "question"];

function Content() {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const dq = useDebounced(q);
  const list = usePaged<AdminContent>(async (offset) => {
    const r = await api.adminContents(dq, type, offset);
    return { success: r.success, data: r.data && { rows: r.data.contents, total: r.data.total } };
  }, [dq, type]);

  const del = async (c: AdminContent) => {
    if (!window.confirm(t("admin.content.confirm", { title: c.title }))) return;
    const r = await api.adminDeleteContent(c.id);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    list.remove((x) => x.id === c.id);
    list.setTotal((n) => n - 1);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <SearchBox value={q} onChange={setQ} label={t("admin.search")} />
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label={t("admin.content.all")} className={input}>
          <option value="">{t("admin.content.all")}</option>
          {CONTENT_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      {list.rows === null ? <Loader2 className="animate-spin text-primary" /> : list.rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("admin.content.none")}</p> : (
        <ul className="rounded-xl border border-border divide-y divide-border bg-card">
          {list.rows.map((c) => (
            <li key={c.id} className="p-4 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:text-primary break-words">{c.title}</a>
                <p className="text-[12px] text-muted-foreground mt-0.5">{c.type} · {c.source} · {new Date(c.createdAt).toLocaleDateString(dateLocale(lang))}</p>
              </div>
              <button onClick={() => del(c)} aria-label={t("admin.content.delete")} title={t("admin.content.delete")} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary flex-shrink-0"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      {list.rows && <Footer shown={list.rows.length} total={list.total} busy={list.busy} onMore={list.more} />}
    </div>
  );
}

const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:5000/api";

function KeyDialog({ school, apiKey, onClose }: { school: string; apiKey: string; onClose: () => void }) {
  const { t } = useI18n();
  const example = `curl -H "X-API-Key: ${apiKey}" ${apiBase.replace(/\/api$/, "")}/api/partner/me`;
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("kairos.copied"));
    } catch {
      toast.error(t("kairos.rateFailed"));
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label={t("admin.school.keyTitle")}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><KeyRound size={18} className="text-primary" /> {t("admin.school.keyTitle")}</h2>
        <p className="text-sm text-muted-foreground mt-2">{t("admin.school.keyText", { school })}</p>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-secondary border border-border p-3">
          <code className="flex-1 font-mono text-[13px] text-foreground break-all select-all">{apiKey}</code>
          <button onClick={() => copy(apiKey)} aria-label={t("kairos.copy")} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card flex-shrink-0"><Copy size={16} /></button>
        </div>
        <p className="text-[12px] text-muted-foreground mt-3">{t("admin.school.keyTry")}</p>
        <pre className="mt-1.5 rounded-xl bg-secondary border border-border p-3 text-[12px] font-mono text-foreground whitespace-pre-wrap break-all">{example}</pre>
        <div className="flex justify-end mt-5">
          <button onClick={onClose} className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold">{t("admin.school.keyDone")}</button>
        </div>
      </div>
    </div>
  );
}

const yearsToText = (years: string[][]) => years.map((y) => y.join(", ")).join("\n");
const textToYears = (text: string) => text.split("\n").map((l) => l.split(",").map((x) => x.trim()).filter(Boolean)).filter((y, i, all) => y.length > 0 || i < all.length - 1);

function SchoolCardAdmin({ school, onChanged, onDeleted }: { school: AdminSchool; onChanged: (s: AdminSchool) => void; onDeleted: () => void }) {
  const { t, lang } = useI18n();
  const [text, setText] = useState(yearsToText(school.curriculum.years));
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const runImport = async () => {
    const content = importText.trim();
    if (!content) return;
    setBusy(true);
    const r = await api.adminImportEvents(school.id, content.startsWith("BEGIN:VCALENDAR") || content.includes("BEGIN:VEVENT") ? "ics" : "csv", content);
    setBusy(false);
    if (!r.success || !r.data) return void toast.error(r.error || t("admin.error"));
    setImportResult(r.data);
    if (r.data.imported > 0) toast.success(t("admin.school.imported", { n: r.data.imported }));
  };
  const dirty = text !== yearsToText(school.curriculum.years);
  const [programme, setProgramme] = useState(school.curriculum.programme ? JSON.stringify(school.curriculum.programme, null, 2) : "");
  const programmeDirty = programme !== (school.curriculum.programme ? JSON.stringify(school.curriculum.programme, null, 2) : "");
  const saveProgramme = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(programme);
    } catch {
      return void toast.error(t("admin.school.badJson"));
    }
    void patch({ curriculum: { programme: parsed } });
  };
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(dateLocale(lang), { dateStyle: "medium", timeStyle: "short" }) : "–");

  const patch = async (input: Parameters<typeof api.adminUpdateSchool>[1]) => {
    setBusy(true);
    const r = await api.adminUpdateSchool(school.id, input);
    setBusy(false);
    if (!r.success || !r.data) return void toast.error(r.error || t("admin.error"));
    onChanged({ ...school, ...r.data.school });
    toast.success(t("admin.user.done"));
  };
  const rotate = async () => {
    if (school.keyPrefix && !window.confirm(t("admin.school.confirmKey", { school: school.name }))) return;
    setBusy(true);
    const r = await api.adminSchoolKey(school.id);
    setBusy(false);
    if (!r.success || !r.data) return void toast.error(r.error || t("admin.error"));
    setNewKey(r.data.key);
    onChanged({ ...school, keyPrefix: r.data.keyPrefix, keyCreatedAt: new Date().toISOString() });
  };
  const remove = async () => {
    if (!window.confirm(t("admin.school.confirmDelete", { school: school.name }))) return;
    const r = await api.adminDeleteSchool(school.id);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    onDeleted();
  };

  return (
    <li className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-[16px] font-semibold text-foreground">{school.name}</h3>
        <span className="text-[12px] font-mono text-muted-foreground">{school.slug}</span>
        <label className="ml-auto inline-flex items-center gap-2 text-[13px] text-foreground cursor-pointer">
          <input type="checkbox" checked={school.active} disabled={busy} onChange={(e) => patch({ active: e.target.checked })} className="accent-[var(--primary)]" /> {t("admin.school.active")}
        </label>
      </div>
      <p className="text-[12.5px] text-muted-foreground mt-1">
        {t("admin.school.learners", { n: school.learners, sharing: school.sharing })} · {school.keyPrefix ? t("admin.school.keyInfo", { prefix: school.keyPrefix, used: when(school.lastUsedAt) }) : t("admin.school.noKey")}
      </p>

      <label className="block mt-4">
        <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("admin.school.curriculum")}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.max(4, school.curriculum.years.length + 1)} spellCheck={false} className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-[13px] font-mono text-foreground focus:outline-none focus:border-primary" />
        <span className="block text-[12px] text-muted-foreground mt-1">{t("admin.school.curriculumHelp")}</span>
      </label>

      <label className="block mt-4">
        <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("admin.school.programme")} {school.curriculum.programme && <span className={school.curriculum.programme.status === "confirmed" ? "text-emerald-600" : "text-amber-600"}>({t(school.curriculum.programme.status === "confirmed" ? "admin.school.status.confirmed" : "admin.school.status.draft")})</span>}</span>
        <textarea value={programme} onChange={(e) => setProgramme(e.target.value)} rows={10} spellCheck={false} placeholder={'{ "status": "draft", "years": [ { "year": 1, "title": "...", "projects": [ { "name": "...", "topics": ["c"], "hours": 30 } ] } ] }'} className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-[12px] font-mono text-foreground focus:outline-none focus:border-primary" />
        <span className="block text-[12px] text-muted-foreground mt-1">{t("admin.school.programmeHelp")}</span>
      </label>
      <details className="mt-4 rounded-xl border border-border">
        <summary className="cursor-pointer px-3.5 py-2.5 text-[13px] font-medium text-foreground">{t("admin.school.importTitle")}</summary>
        <div className="px-3.5 pb-3.5">
          <p className="text-[12px] text-muted-foreground leading-relaxed">{t("admin.school.importHelp")}</p>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={6} spellCheck={false} placeholder={"title,start,end,kind,year\nZappy: final delivery,2030-02-10T09:00:00Z,2030-02-10T18:00:00Z,deadline,2"} className="w-full mt-2 rounded-xl bg-secondary border border-border px-3 py-2.5 text-[12px] font-mono text-foreground focus:outline-none focus:border-primary" />
          <div className="flex items-center gap-3 mt-2">
            <button onClick={runImport} disabled={busy || !importText.trim()} className="px-4 h-9 rounded-lg bg-primary text-white text-[13px] font-semibold disabled:opacity-40">{t("admin.school.import")}</button>
            {importResult && <span className="text-[12.5px] text-muted-foreground">{t("admin.school.imported", { n: importResult.imported })}{importResult.errors.length > 0 ? ` · ${importResult.errors.length} ${t("admin.school.errors")}` : ""}</span>}
          </div>
          {importResult && importResult.errors.length > 0 && <ul className="mt-2 text-[12px] text-destructive space-y-0.5">{importResult.errors.slice(0, 5).map((e) => <li key={e}>{e}</li>)}</ul>}
        </div>
      </details>

      <div className="flex flex-wrap gap-2 mt-4">
        <button disabled={!programmeDirty || busy} onClick={saveProgramme} className="px-4 h-9 rounded-lg bg-primary text-white text-[13px] font-semibold disabled:opacity-40">{t("admin.school.saveProgramme")}</button>
        <button disabled={!dirty || busy} onClick={() => patch({ curriculum: { years: textToYears(text) } })} className="px-4 h-9 rounded-lg bg-primary text-white text-[13px] font-semibold disabled:opacity-40">{t("common.save")}</button>
        <button disabled={busy} onClick={rotate} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary"><KeyRound size={14} /> {school.keyPrefix ? t("admin.school.rotate") : t("admin.school.generate")}</button>
        <button onClick={remove} className="ml-auto inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-destructive/40 text-[13px] text-destructive hover:bg-destructive/10"><Trash2 size={14} /> {t("cal.delete")}</button>
      </div>
      {newKey && <KeyDialog school={school.name} apiKey={newKey} onClose={() => setNewKey(null)} />}
    </li>
  );
}

function Schools() {
  const { t } = useI18n();
  const [list, setList] = useState<AdminSchool[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.adminSchools().then((r) => setList(r.success ? r.data!.schools : []));
  }, []);

  const create = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    const r = await api.adminCreateSchool({ name: name.trim(), contactEmail: email.trim() || null });
    setBusy(false);
    if (!r.success || !r.data) return void toast.error(r.error || t("admin.error"));
    setList((cur) => [...(cur ?? []), { ...r.data!.school, learners: 0, sharing: 0 }]);
    setName("");
    setEmail("");
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4 max-w-3xl leading-relaxed">{t("admin.school.intro")}</p>
      <div className="flex flex-wrap gap-3 mb-6">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("admin.school.name")} aria-label={t("admin.school.name")} maxLength={80} className={`${input} flex-1 min-w-[180px]`} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("admin.school.email")} aria-label={t("admin.school.email")} type="email" className={`${input} flex-1 min-w-[180px]`} />
        <button onClick={create} disabled={busy || name.trim().length < 2} className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"><Plus size={16} /> {t("admin.school.add")}</button>
      </div>
      {list === null ? <Loader2 className="animate-spin text-primary" /> : list.length === 0 ? <p className="text-sm text-muted-foreground">{t("admin.school.none")}</p> : (
        <ul className="space-y-4">
          {list.map((sc) => (
            <SchoolCardAdmin key={sc.id} school={sc} onChanged={(next) => setList((cur) => (cur ?? []).map((x) => (x.id === next.id ? next : x)))} onDeleted={() => setList((cur) => (cur ?? []).filter((x) => x.id !== sc.id))} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** The administrators' area: numbers, people, moderation and the content catalogue. */
export function AdminScreen({ user }: { user: User | null }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");

  if (user?.role !== "admin") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 px-6">
        <ShieldCheck size={32} className="text-muted-foreground" />
        <h1 className="text-xl font-bold text-foreground">{t("admin.denied")}</h1>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-16">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5 mb-5"><ShieldCheck className="text-primary" /> {t("admin.title")}</h1>
        <div role="tablist" className="flex gap-1 mb-6 border-b border-border overflow-x-auto no-scrollbar">
          {TABS.map((x) => (
            <button key={x} role="tab" aria-selected={tab === x} onClick={() => setTab(x)} className={`px-4 h-10 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === x ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t(`admin.tab.${x}` as const)}
            </button>
          ))}
        </div>
        {tab === "overview" && <Overview />}
        {tab === "users" && <Users me={user} />}
        {tab === "schools" && <Schools />}
        {tab === "moderation" && <Moderation />}
        {tab === "content" && <Content />}
      </div>
    </div>
  );
}
