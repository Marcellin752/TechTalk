import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Check, ChevronDown, Circle, Clock, List, Loader2, Map as MapIcon, Play, RefreshCw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { api, LearningPath, LearningProfile, PathStep, PathSummary, StepStatus } from "../services/api";
import { PathSwitcher } from "../components/PathSwitcher";
import { NewPathDialog } from "../components/NewPathDialog";
import { Modal } from "../components/Modal";
import { SchoolCard } from "../components/SchoolCard";
import { RoadmapMap } from "../components/RoadmapMap";
import { KIND_LABEL_KEYS, formatMinutes, typeLabel } from "../lib/learning";
import { useI18n } from "../lib/i18n";
import { pathFor, ROUTES } from "../lib/routes";
import { mapBackendContentToItem } from "../lib/content";

interface PathScreenProps {
  path: LearningPath | null;
  loaded: boolean;
  onPath: (path: LearningPath | null) => void;
  profile?: LearningProfile | null;
  onProfile?: (profile: LearningProfile) => void;
}

function StepRow({ step, onStatus, onOpen }: { step: PathStep; onStatus: (s: StepStatus) => void; onOpen: () => void }) {
  const { t } = useI18n();
  const done = step.status === "done";
  return (
    <li className={`flex items-start gap-3 py-3 ${done ? "opacity-60" : ""}`}>
      <button
        onClick={() => onStatus(done ? "todo" : "done")}
        aria-label={done ? t("path.markUndone") : t("path.markDone")}
        aria-pressed={done}
        className={`mt-0.5 w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${done ? "bg-primary border-primary text-white" : step.status === "doing" ? "border-primary text-primary" : "border-border text-transparent hover:border-primary"}`}
      >
        {done ? <Check size={14} strokeWidth={3} /> : step.status === "doing" ? <Circle size={8} className="fill-current" /> : <Check size={14} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
          <span className="text-primary">{t(KIND_LABEL_KEYS[step.kind])}</span>
          {typeLabel(t, step.content.type) !== t(KIND_LABEL_KEYS[step.kind]) && (
            <>
              <span>·</span>
              <span>{typeLabel(t, step.content.type)}</span>
            </>
          )}
          <span>·</span>
          <span className="truncate normal-case tracking-normal">{step.content.source}</span>
        </div>
        <button onClick={onOpen} className={`text-left text-[14.5px] font-medium leading-snug mt-0.5 hover:text-primary transition-colors ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {step.content.title}
        </button>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0 pt-0.5">
        <span className="hidden sm:inline-flex items-center gap-1 text-[12px] text-muted-foreground">
          <Clock size={12} /> {formatMinutes(step.minutes)}
        </span>
        {!done && (
          <button onClick={onOpen} className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-secondary hover:bg-muted text-[12.5px] font-semibold text-foreground">
            {step.status === "doing" ? t("path.resumeBtn") : t("path.start")} <ArrowUpRight size={13} />
          </button>
        )}
      </div>
    </li>
  );
}

export function PathScreen({ path: primary, loaded, onPath: onPrimary, profile = null, onProfile }: PathScreenProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [paths, setPaths] = useState<PathSummary[] | null>(null);
  const [max, setMax] = useState(6);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fetched, setFetched] = useState<LearningPath | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [view, setView] = useState<"map" | "list">(() => {
    try {
      return localStorage.getItem("teachtalk_path_view") === "list" ? "list" : "map";
    } catch {
      return "map";
    }
  });
  const chooseView = (v: "map" | "list") => {
    setView(v);
    try {
      localStorage.setItem("teachtalk_path_view", v);
    } catch {
      /* remembered only when storage works */
    }
  };

  // The path on screen: the main one comes from the app; the others are fetched when chosen.
  const path = selectedId && primary && selectedId === primary.id ? primary : fetched && fetched.id === selectedId ? fetched : null;

  const refreshList = useCallback(async () => {
    try {
      const r = await api.getPaths();
      setPaths(r.paths);
      setMax(r.max);
      return r.paths;
    } catch {
      setPaths((cur) => cur ?? []);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void refreshList().then((list) => {
      if (!list) return;
      const wanted = params.get("p");
      setSelectedId((cur) => cur ?? (list.find((x) => x.id === wanted)?.id ?? list.find((x) => x.active)?.id ?? list[0]?.id ?? null));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    if (!selectedId || (primary && selectedId === primary.id) || fetched?.id === selectedId) return;
    let cancelled = false;
    api.getPathById(selectedId).then((v) => !cancelled && v && setFetched(v));
    return () => {
      cancelled = true;
    };
  }, [selectedId, primary, fetched?.id]);

  const select = (id: string) => {
    setSelectedId(id);
    setParams(id === paths?.find((x) => x.active)?.id ? {} : { p: id }, { replace: true });
  };

  /** A path changed: keep the app's main path and the switcher in step. */
  const setCurrent = (v: LearningPath) => {
    if (v.active) onPrimary(v);
    else setFetched(v);
    void refreshList();
  };

  // The current stage opens by itself.
  useEffect(() => {
    if (path?.currentStage != null) setOpen((o) => (path.currentStage! in o ? o : { ...o, [path.currentStage!]: true }));
  }, [path?.currentStage, path?.id]);

  const update = async (step: PathStep, status: StepStatus) => {
    const res = await api.setStepStatus(step.id, status);
    if (res.success && res.path) setCurrent(res.path);
    else toast.error(res.error || t("path.saveError"));
  };

  const openStep = (step: PathStep) => {
    if (step.status === "todo") void update(step, "doing");
    const item = mapBackendContentToItem({ ...step.content, createdAt: new Date().toISOString() });
    const internal = pathFor(item);
    if (internal) navigate(internal, { state: { item } });
    else window.open(step.content.url, "_blank", "noopener,noreferrer");
  };

  const rebuild = async () => {
    if (!selectedId) return;
    setBusy(true);
    const res = await api.rebuildPath(selectedId);
    setBusy(false);
    if (res.success && res.path) {
      setCurrent(res.path);
      toast.success(t("path.rebuilt"));
    } else toast.error(res.error || t("path.saveError"));
  };

  const makeMain = async () => {
    if (!selectedId) return;
    const r = await api.updatePath(selectedId, { active: true });
    if (!r.success) return void toast.error(r.error || t("path.saveError"));
    setPaths(r.paths);
    const v = await api.getPathById(selectedId);
    if (v) onPrimary(v);
    toast.success(t("paths.nowMain"));
  };

  const remove = async () => {
    if (!selectedId || !paths) return;
    const target = paths.find((x) => x.id === selectedId);
    if (!window.confirm(t("paths.deleteConfirm", { name: target?.title ?? "" }))) return;
    const r = await api.deletePath(selectedId);
    if (!r.success) return void toast.error(r.error || t("path.saveError"));
    setPaths(r.paths);
    setFetched(null);
    const next = r.paths.find((x) => x.active) ?? r.paths[0] ?? null;
    setSelectedId(next?.id ?? null);
    setParams({}, { replace: true });
    if (next?.active) {
      const v = await api.getPathById(next.id);
      onPrimary(v);
    } else if (!next) onPrimary(null);
    toast.success(t("paths.deleted"));
  };

  if (!loaded || (primary == null && paths === null)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!path && paths && paths.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
        <h1 className="text-2xl font-bold text-foreground">{t("path.empty.title")}</h1>
        <p className="text-muted-foreground max-w-md">{t("path.empty.text")}</p>
        <button onClick={() => navigate(ROUTES.onboarding)} className="mt-2 px-6 h-11 rounded-xl bg-primary text-white text-sm font-semibold shadow-md shadow-primary/25">
          {t("common.getStarted")}
        </button>
      </div>
    );
  }

  if (!path) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  const p = path.progress;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-16">
        {paths && paths.length > 0 && (
          <div className="mb-5">
            <PathSwitcher
              paths={paths}
              selectedId={selectedId}
              max={max}
              onSelect={select}
              onNew={() => setCreating(true)}
              onRename={() => setRenaming(true)}
              onMakeMain={makeMain}
              onRebuild={rebuild}
              onDelete={remove}
            />
          </div>
        )}

        {/* Summary */}
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-primary">{path.kind === "school" ? t("paths.kind.school") : path.kind === "custom" ? t("paths.kind.custom") : t("path.eyebrow")}{path.active ? ` · ${t("paths.main")}` : ""}</p>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">{path.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("path.summary", { stages: path.stages.length, time: formatMinutes(p.minutesTotal), weeks: p.weeksTotal, hours: path.hoursPerWeek })}
          </p>
          {path.kind === "school" && path.programmeDraft && (
            <p className="mt-3 text-[12.5px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 leading-relaxed">{t("paths.draftNote")}</p>
          )}

          <div className="mt-5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold text-foreground">{t("path.complete", { n: p.percent })}</span>
              <span className="text-muted-foreground">
                {t("path.steps", { done: p.doneSteps, total: p.totalSteps })} · {p.percent === 100 ? t("path.finished") : t("path.weeksLeft", { n: p.weeksLeft })}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-secondary overflow-hidden mt-2" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${p.percent}%` }} />
            </div>
          </div>

        </section>

        <SchoolCard
          profile={profile}
          onUpdated={(p, schoolPath, list) => {
            onProfile?.(p);
            setPaths(list);
            if (schoolPath) {
              setSelectedId(schoolPath.id);
              setCurrent(schoolPath);
            }
          }}
        />

        {/* The path, as a map of nodes or as a list */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-foreground">{t("path.stagesTitle")}</h2>
          <div role="radiogroup" aria-label={t("path.view")} className="flex rounded-lg border border-border bg-secondary p-0.5">
            {([["map", MapIcon, "path.view.map"], ["list", List, "path.view.list"]] as const).map(([id, Icon, label]) => (
              <button key={id} role="radio" aria-checked={view === id} onClick={() => chooseView(id)} className={`inline-flex items-center gap-1.5 px-3 h-7 rounded-md text-[13px] font-medium transition-colors ${view === id ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon size={14} /> {t(label)}
              </button>
            ))}
          </div>
        </div>

        {view === "map" && (
          <div className="mt-4">
            <RoadmapMap path={path} onStatus={update} onOpen={openStep} />
          </div>
        )}

        {/* Stages */}
        <ol className={`mt-4 space-y-4 ${view === "map" ? "hidden" : ""}`}>
          {path.stages.map((stage) => {
            const isCurrent = path.currentStage === stage.index;
            const expanded = !!open[stage.index];
            return (
              <li key={stage.index} className="relative pl-12">
                <span className={`absolute left-0 top-4 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${stage.complete ? "bg-primary text-white" : isCurrent ? "bg-primary/15 text-primary border-2 border-primary" : "bg-secondary text-muted-foreground"}`}>
                  {stage.complete ? <Check size={16} strokeWidth={3} /> : stage.index + 1}
                </span>
                {stage.index < path.stages.length - 1 && <span aria-hidden className="absolute left-[17px] top-14 bottom-[-1rem] w-px bg-border" />}

                <section className={`rounded-2xl border bg-card ${isCurrent ? "border-primary/50" : "border-border"}`}>
                  <button onClick={() => setOpen((o) => ({ ...o, [stage.index]: !expanded }))} aria-expanded={expanded} className="w-full text-left p-4 sm:p-5 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[16px] font-semibold text-foreground">{stage.title}</h2>
                      <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{stage.objective}</p>
                      {stage.topics && stage.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">{stage.topics.map((tp) => <span key={tp} className="px-2 h-5 inline-flex items-center rounded-full bg-primary/10 text-primary text-[11px] font-mono">{tp}</span>)}</div>
                      )}
                      <p className="text-[12px] text-muted-foreground mt-2">
                        {t("path.doneOf", { done: stage.done, total: stage.total })} · {formatMinutes(stage.minutes)}
                      </p>
                    </div>
                    <ChevronDown size={18} className={`text-muted-foreground mt-1 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  {expanded && (
                    <ul className="px-4 sm:px-5 pb-3 divide-y divide-border border-t border-border">
                      {stage.steps.map((step) => (
                        <StepRow key={step.id} step={step} onStatus={(s) => update(step, s)} onOpen={() => openStep(step)} />
                      ))}
                    </ul>
                  )}
                </section>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={() => navigate(`${ROUTES.onboarding}?edit=1`)} className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary">
            <SlidersHorizontal size={15} /> {t("path.edit")}
          </button>
          <button onClick={rebuild} disabled={busy} className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-60">
            <RefreshCw size={15} className={busy ? "animate-spin" : ""} /> {t("path.rebuild")}
          </button>
        </div>
      </div>

      {creating && paths && (
        <NewPathDialog
          profile={profile}
          paths={paths}
          onClose={() => setCreating(false)}
          onCreated={(created) => {
            setSelectedId(created.id);
            setCurrent(created);
          }}
        />
      )}
      {renaming && <RenameDialog current={path.title} onClose={() => setRenaming(false)} onSave={async (title) => {
        const r = await api.updatePath(path.id, { title });
        if (!r.success) return void toast.error(r.error || t("path.saveError"));
        setPaths(r.paths);
        const renamed = { ...path, title };
        if (path.active) onPrimary(renamed);
        else setFetched(renamed);
        setRenaming(false);
      }} />}
    </div>
  );
}

function RenameDialog({ current, onClose, onSave }: { current: string; onClose: () => void; onSave: (title: string) => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(current);
  return (
    <Modal title={t("paths.rename")} onClose={onClose}>
      <div className="px-5 py-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && title.trim().length >= 2 && onSave(title.trim())} maxLength={80} aria-label={t("paths.name")} className="w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" autoFocus />
      </div>
      <div className="flex justify-end gap-2 px-5 pb-5">
        <button onClick={onClose} className="px-4 h-10 rounded-xl border border-border text-sm text-foreground hover:bg-secondary">{t("common.cancel")}</button>
        <button onClick={() => onSave(title.trim())} disabled={title.trim().length < 2} className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60">{t("common.save")}</button>
      </div>
    </Modal>
  );
}
