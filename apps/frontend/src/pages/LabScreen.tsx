import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FlaskConical, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import { askKairos, topicSlug } from "../lib/askKairos";
import { useI18n } from "../lib/i18n";
import { btnCls, ghostCls, inputCls, Page, PageHeader, Section, Tabs } from "../components/PageHeader";

interface Milestone { title: string; done: boolean }
interface Project { id: string; title: string; description: string | null; repoUrl: string | null; topics: string[]; status: "idea" | "building" | "done"; milestones: Milestone[]; isPublic: boolean }
interface RItem { id: string; kind: "source" | "note"; title: string; url: string | null; note: string | null }

/** Where things get built (projects) and gathered (research). A finished project with a repository is the strongest proof of a skill. */
export function LabScreen() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"projects" | "research">("projects");
  return (
    <Page wide>
      <PageHeader icon={FlaskConical} title={t("lab.title")} subtitle={t("lab.subtitle")} />
      <Tabs value={tab} onChange={setTab} items={[{ id: "projects", label: t("lab.projects") }, { id: "research", label: t("lab.research") }]} />
      {tab === "projects" ? <Projects /> : <Research />}
    </Page>
  );
}

function Projects() {
  const { t } = useI18n();
  const [list, setList] = useState<Project[] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topics, setTopics] = useState("");
  const [plan, setPlan] = useState<Milestone[]>([]);
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();
  // Arriving from a concept or a Kairos suggestion: the idea is already there.
  useEffect(() => {
    const n = params.get("new"), tp = params.get("topic");
    if (n) { setTitle(n.slice(0, 120)); setDescription(t("lab.fromSkill", { name: n })); }
    if (tp) setTopics(tp.slice(0, 60));
  }, [params, t]);

  const load = useCallback(() => { api.growth<{ projects: Project[] }>("/projects").then((r) => setList(r.data?.projects ?? [])); }, []);
  useEffect(load, [load]);

  const topicList = () => topics.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const suggest = async () => {
    setBusy(true);
    const r = await api.growth<{ milestones: Milestone[] }>("/projects/plan", "POST", { title, description });
    setBusy(false);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    setPlan(r.data!.milestones);
  };
  const create = async () => {
    setBusy(true);
    const r = await api.growth("/projects", "POST", { title, description, topics: topicList(), milestones: plan });
    setBusy(false);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    setTitle(""); setDescription(""); setTopics(""); setPlan([]);
    load();
  };
  const patch = async (id: string, body: Record<string, unknown>) => {
    const r = await api.growth(`/projects/${id}`, "PATCH", body);
    if (!r.success) toast.error(r.error || t("admin.error"));
    load();
  };
  const remove = async (id: string) => {
    if (!window.confirm(t("lab.deleteConfirm"))) return;
    await api.growth(`/projects/${id}`, "DELETE");
    load();
  };

  return (
    <>
      <Section title={t("lab.newProject")}>
        <div className="space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("lab.titlePh")} className={inputCls} />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} placeholder={t("lab.descPh")} className={inputCls} />
          <input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder={t("lab.topicsPh")} className={inputCls} />
          {plan.length > 0 && (
            <ul className="rounded-xl border border-border bg-card p-3 space-y-1.5">
              {plan.map((m, i) => (
                <li key={i} className="flex items-center gap-2 text-sm"><span className="flex-1">{m.title}</span><button aria-label={t("common.delete")} onClick={() => setPlan(plan.filter((_, k) => k !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button></li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 flex-wrap">
            <button disabled={busy || title.trim().length < 2} onClick={create} className={btnCls}><Plus size={15} /> {t("lab.create")}</button>
            <button disabled={busy || title.trim().length < 2} onClick={suggest} className={ghostCls}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {t("lab.suggest")}</button>
          </div>
        </div>
      </Section>

      {list === null && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>}
      {list && list.length === 0 && <p className="text-center text-sm text-muted-foreground">{t("lab.empty")}</p>}
      <div className="space-y-4">
        {list?.map((p) => <ProjectCard key={p.id} p={p} onPatch={patch} onDelete={remove} />)}
      </div>
    </>
  );
}

function ProjectCard({ p, onPatch, onDelete }: { p: Project; onPatch: (id: string, b: Record<string, unknown>) => void; onDelete: (id: string) => void }) {
  const { t } = useI18n();
  const [repo, setRepo] = useState(p.repoUrl ?? "");
  const [newMs, setNewMs] = useState("");
  const doneCount = p.milestones.filter((m) => m.done).length;
  return (
    <article className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground">{p.title}</h3>
          {p.description && <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{p.description}</p>}
          {p.topics.length > 0 && <p className="text-[12px] text-muted-foreground mt-1">{p.topics.map((tp, i) => <span key={tp}>{i > 0 && " · "}<Link to={`/skills/${topicSlug(tp)}`} className="underline underline-offset-2">{tp}</Link></span>)}</p>}
          <Link to={askKairos(t("ask.project", { name: p.title }))} className="text-[12px] font-semibold text-primary mt-1 inline-block">{t("ask.kairos")}</Link>
        </div>
        <select aria-label={t("lab.status")} value={p.status} onChange={(e) => onPatch(p.id, { status: e.target.value })} className="rounded-lg border border-border bg-background px-2 h-8 text-[13px]">
          {(["idea", "building", "done"] as const).map((s) => <option key={s} value={s}>{t(`lab.status.${s}`)}</option>)}
        </select>
        <button aria-label={t("common.delete")} onClick={() => onDelete(p.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button>
      </header>
      {p.milestones.length > 0 && (
        <div>
          <p className="text-[12px] text-muted-foreground mb-1">{doneCount}/{p.milestones.length}</p>
          <ul className="space-y-1">
            {p.milestones.map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={m.done} onChange={() => onPatch(p.id, { milestones: p.milestones.map((x, k) => (k === i ? { ...x, done: !x.done } : x)) })} aria-label={m.title} />
                <span className={m.done ? "line-through text-muted-foreground" : "text-foreground"}>{m.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-2">
        <input value={newMs} onChange={(e) => setNewMs(e.target.value)} maxLength={120} placeholder={t("lab.addMilestone")} className={inputCls} />
        <button disabled={!newMs.trim()} onClick={() => { onPatch(p.id, { milestones: [...p.milestones, { title: newMs.trim(), done: false }] }); setNewMs(""); }} className={ghostCls}>+</button>
      </div>
      <div className="flex gap-2">
        <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder={t("lab.repoPh")} className={inputCls} />
        <button onClick={() => onPatch(p.id, { repoUrl: repo })} className={ghostCls}>{t("common.save")}</button>
        {p.repoUrl && <a href={p.repoUrl} target="_blank" rel="noreferrer" aria-label={t("lab.openRepo")} className={ghostCls}><ExternalLink size={14} /></a>}
      </div>
      <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <input type="checkbox" checked={p.isPublic} onChange={() => onPatch(p.id, { isPublic: !p.isPublic })} /> {t("lab.public")}
      </label>
      {p.status === "done" && <p className="text-[12px] text-emerald-700 dark:text-emerald-400">{t("lab.countsAsProof")}</p>}
    </article>
  );
}

function Research() {
  const { t } = useI18n();
  const [workspaces, setWorkspaces] = useState<Array<{ name: string; n: number }>>([]);
  const [ws, setWs] = useState("");
  const [items, setItems] = useState<RItem[]>([]);
  const [kind, setKind] = useState<"source" | "note">("source");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (name: string) => {
    const r = await api.growth<{ workspaces: Array<{ name: string; n: number }>; items: RItem[] }>(`/research${name ? `?workspace=${encodeURIComponent(name)}` : ""}`);
    setWorkspaces(r.data?.workspaces ?? []);
    setItems(r.data?.items ?? []);
  }, []);
  useEffect(() => { load(ws); setSynthesis(null); }, [ws, load]);

  const add = async () => {
    setBusy(true);
    const r = await api.growth("/research", "POST", { workspace: ws, kind, title, url: url || undefined, note: note || undefined });
    setBusy(false);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    setTitle(""); setUrl(""); setNote("");
    load(ws);
  };
  const synthesize = async () => {
    setBusy(true);
    const r = await api.growth<{ synthesis: string }>("/research/synthesize", "POST", { workspace: ws });
    setBusy(false);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    setSynthesis(r.data!.synthesis);
  };

  return (
    <>
      <Section title={t("research.workspace")}>
        <div className="flex flex-wrap gap-2 mb-2">
          {workspaces.map((w) => <button key={w.name} onClick={() => setWs(w.name)} className={`px-3 py-1.5 rounded-xl text-[13px] font-medium ${ws === w.name ? "bg-primary text-white" : "bg-secondary text-foreground"}`}>{w.name} · {w.n}</button>)}
        </div>
        <input value={ws} onChange={(e) => setWs(e.target.value)} maxLength={80} placeholder={t("research.workspacePh")} className={inputCls} />
      </Section>
      {ws.trim() && (
        <>
          <Section title={t("research.add")}>
            <div className="space-y-2">
              <div className="flex gap-2">
                {(["source", "note"] as const).map((k) => <button key={k} onClick={() => setKind(k)} className={`${ghostCls} ${kind === k ? "!bg-secondary" : ""}`}>{t(`research.${k}`)}</button>)}
              </div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={t("research.titlePh")} className={inputCls} />
              {kind === "source" && <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={inputCls} />}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={4000} placeholder={t("research.notePh")} className={inputCls} />
              <button disabled={busy || !title.trim() || (kind === "source" && !url.trim())} onClick={add} className={btnCls}><Plus size={15} /> {t("memory.add")}</button>
            </div>
          </Section>
          <Section title={`${t("research.items")} · ${items.length}`}>
            <ul className="space-y-2">
              {items.map((i, k) => (
                <li key={i.id} className="rounded-xl border border-border bg-card px-4 py-3 flex gap-3">
                  <span className="text-[12px] text-muted-foreground mt-0.5">[{k + 1}]</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{i.url ? <a href={i.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{i.title}</a> : i.title}</p>
                    {i.note && <p className="text-[13px] text-muted-foreground whitespace-pre-wrap mt-0.5">{i.note}</p>}
                  </div>
                  <button aria-label={t("common.delete")} onClick={async () => { await api.growth(`/research/${i.id}`, "DELETE"); load(ws); }} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
            {items.length >= 2 && <button disabled={busy} onClick={synthesize} className={`${ghostCls} mt-3`}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {t("research.synthesize")}</button>}
            {synthesis && <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 mt-3 text-sm whitespace-pre-wrap text-foreground">{synthesis}</div>}
          </Section>
        </>
      )}
    </>
  );
}
