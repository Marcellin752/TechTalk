import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Check, ChevronDown, Circle, Clock, Loader2, Play, RefreshCw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { api, LearningPath, PathStep, StepStatus } from "../services/api";
import { KIND_LABEL_KEYS, formatMinutes, typeLabel } from "../lib/learning";
import { useI18n } from "../lib/i18n";
import { pathFor, ROUTES } from "../lib/routes";
import { mapBackendContentToItem } from "../lib/content";

interface PathScreenProps {
  path: LearningPath | null;
  loaded: boolean;
  onPath: (path: LearningPath | null) => void;
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

export function PathScreen({ path, loaded, onPath }: PathScreenProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);

  // The current stage opens by itself.
  useEffect(() => {
    if (path?.currentStage != null) setOpen((o) => (path.currentStage! in o ? o : { ...o, [path.currentStage!]: true }));
  }, [path?.currentStage]);

  const update = async (step: PathStep, status: StepStatus) => {
    const res = await api.setStepStatus(step.id, status);
    if (res.success && res.path) onPath(res.path);
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
    setBusy(true);
    const res = await api.regenerateLearningPath();
    setBusy(false);
    if (res.success && res.path) {
      onPath(res.path);
      toast.success(t("path.rebuilt"));
    } else toast.error(res.error || t("path.saveError"));
  };

  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!path) {
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

  const p = path.progress;
  const next = path.next;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-16">
        {/* Summary */}
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-primary">{t("path.eyebrow")}</p>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1">{path.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("path.summary", { stages: path.stages.length, time: formatMinutes(p.minutesTotal), weeks: p.weeksTotal, hours: path.hoursPerWeek })}
          </p>

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

          {next && (
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-primary/10 border border-primary/30 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-mono uppercase tracking-wide text-primary">{next.status === "doing" ? t("path.resume") : t("path.next")}</p>
                <p className="text-[15px] font-semibold text-foreground leading-snug truncate">{next.content.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {typeLabel(t, next.content.type)} · {next.content.source} · {formatMinutes(next.minutes)}
                </p>
              </div>
              <button onClick={() => openStep(next)} className="inline-flex items-center justify-center gap-2 px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold shadow-md shadow-primary/25 flex-shrink-0">
                <Play size={14} className="fill-white" /> {next.status === "doing" ? t("path.resumeBtn") : t("path.start")}
              </button>
            </div>
          )}
        </section>

        {/* Stages */}
        <ol className="mt-8 space-y-4">
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
    </div>
  );
}
