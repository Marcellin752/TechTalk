import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock, Flag, RotateCcw } from "lucide-react";
import type { LearningPath, PathStageView, PathStep, StepStatus } from "../services/api";
import { KIND_LABEL_KEYS, formatMinutes } from "../lib/learning";
import { useI18n } from "../lib/i18n";

interface Props {
  path: LearningPath;
  onStatus: (step: PathStep, status: StepStatus) => void;
  onOpen: (step: PathStep) => void;
  /** Opens the checkpoint quiz of a finished stage. */
  onQuiz?: (stage: PathStageView) => void;
}

const COLUMN = 288; // px, one stage
const GAP = 96; // px, room for the curved links between two stages

/** A checkpoint (a yes / not yet decision) follows the stages where you practise or build something. */
export const hasCheckpoint = (stage: PathStageView) => stage.steps.some((s) => s.kind === "practice" || s.kind === "project");

/** One step: a node on its stage's trunk, with a card hanging off a short branch. */
function StepNode({ step, onStatus, onOpen }: { step: PathStep; onStatus: (s: StepStatus) => void; onOpen: () => void }) {
  const { t } = useI18n();
  const done = step.status === "done";
  const doing = step.status === "doing";
  return (
    <li className="relative pl-10 py-1.5" data-node>
      <span aria-hidden className={`absolute left-[15px] top-[26px] w-[14px] h-[14px] rounded-full border-2 bg-card ${done ? "bg-primary border-primary" : doing ? "border-primary" : "border-border"}`}>
        {doing && <span className="absolute inset-[2px] rounded-full bg-primary" />}
      </span>
      <span aria-hidden className={`absolute left-[29px] top-[32px] w-[11px] h-0.5 ${done || doing ? "bg-primary" : "bg-border"}`} />

      <div className={`flex items-stretch rounded-xl border transition-colors ${done ? "border-border bg-secondary/60" : doing ? "border-primary/60 bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}>
        <button onClick={onOpen} className="min-w-0 flex-1 text-left px-3 py-2">
          <span className="block text-[10px] font-mono uppercase tracking-wide text-primary">{t(KIND_LABEL_KEYS[step.kind])}</span>
          <span className={`block text-[13px] leading-snug mt-0.5 line-clamp-2 ${done ? "line-through text-muted-foreground" : "text-foreground font-medium"}`}>{step.content.title}</span>
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clock size={11} /> {formatMinutes(step.minutes)}</span>
        </button>
        <button
          onClick={() => onStatus(done ? "todo" : "done")}
          aria-pressed={done}
          aria-label={done ? t("path.markUndone") : t("path.markDone")}
          className="w-10 flex-shrink-0 flex items-center justify-center border-l border-border/70 rounded-r-xl text-muted-foreground hover:bg-secondary"
        >
          <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${done ? "bg-primary border-primary text-white" : "border-border"}`}>
            <Check size={12} strokeWidth={3} className={done ? "" : "opacity-0"} />
          </span>
        </button>
      </div>
    </li>
  );
}

/** The decision at the end of a stage: ready to move on (yes), or go back over it (not yet).
 *  Three rows: the question, the diamond with the "yes" line running out to the right, then what each answer means. */
function Checkpoint({ stage, anchor, onQuiz }: { stage: PathStageView; anchor: (el: HTMLElement | null) => void; onQuiz?: (stage: PathStageView) => void }) {
  const { t } = useI18n();
  const passed = stage.checkpoint.passed;
  return (
    <div className="relative pl-10 pt-3" data-checkpoint>
      <span aria-hidden className={`absolute left-[21px] top-0 h-[96px] w-0.5 ${passed ? "bg-primary/50" : "bg-border"}`} />
      <p className="text-[12px] font-semibold text-foreground leading-tight">{t("path.checkpoint")}</p>
      {/* the diamond sits on the trunk; the link to the next stage starts here and runs right */}
      <div className="relative h-11">
        <span
          ref={anchor}
          aria-hidden
          className={`absolute -left-[31px] top-[8px] w-[26px] h-[26px] rotate-45 rounded-[5px] border-2 ${passed ? "bg-primary border-primary" : stage.complete ? "bg-primary/20 border-primary" : "bg-card border-border"}`}
        />
      </div>
      {passed ? (
        <p className="flex items-center gap-1.5 text-[11.5px]">
          <span className="px-1.5 py-0.5 rounded font-semibold bg-primary/15 text-primary">{t("path.yes")}</span>
          <span className="text-muted-foreground">{t("quiz.passedShort", { score: stage.checkpoint.bestScore ?? 0, total: stage.checkpoint.total ?? 0 })}</span>
        </p>
      ) : stage.complete ? (
        <button onClick={() => onQuiz?.(stage)} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-primary text-white text-[12px] font-semibold shadow-md shadow-primary/25">
          {stage.checkpoint.attempts > 0 ? t("quiz.tryAgain") : t("quiz.take")}
        </button>
      ) : (
        <p className="flex items-center gap-1.5 text-[11.5px]">
          <span className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-semibold">{t("path.no")}</span>
          <span className="text-muted-foreground">{t("path.yesWhen")}</span>
        </p>
      )}
      {!passed && !stage.complete && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><RotateCcw size={11} /> {t("path.noLoop")}</p>
      )}
    </div>
  );
}

interface Link { d: string; done: boolean; label?: { x: number; y: number; text: string } }

/**
 * The path as a tree: each stage is a trunk of step nodes; stages are joined by curved links,
 * and a yes / not yet checkpoint follows the stages that ask you to practise. It scrolls
 * sideways inside its own bordered section.
 */
export function RoadmapMap({ path, onStatus, onOpen, onQuiz }: Props) {
  const { t } = useI18n();
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const columns = useRef<Array<HTMLDivElement | null>>([]);
  const heads = useRef<Array<HTMLSpanElement | null>>([]);
  const anchors = useRef<Array<HTMLElement | null>>([]);
  const [edge, setEdge] = useState({ left: false, right: true });
  const [links, setLinks] = useState<Link[]>([]);

  const measureEdges = () => {
    const el = scroller.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };

  /** Draws a curve from the end of each stage to the start of the next, from where things really are. */
  const measureLinks = () => {
    const root = list.current;
    if (!root) return;
    const origin = root.getBoundingClientRect();
    const next: Link[] = [];
    for (let i = 0; i < path.stages.length - 1; i++) {
      const stage = path.stages[i]!;
      const col = columns.current[i];
      const head = heads.current[i + 1];
      if (!col || !head) continue;
      const c = col.getBoundingClientRect();
      const h = head.getBoundingClientRect();
      const anchor = anchors.current[i];
      let x1: number;
      let y1: number;
      let xStart: number | null = null;
      if (anchor) {
        const a = anchor.getBoundingClientRect();
        x1 = c.right - origin.left; // the line runs from the diamond out to the column's edge
        y1 = a.top + a.height / 2 - origin.top;
        xStart = a.left + a.width - origin.left - 2;
      } else {
        const nodes = col.querySelectorAll("[data-node]");
        const last = nodes[nodes.length - 1] as HTMLElement | undefined;
        const r = last?.getBoundingClientRect();
        x1 = c.right - origin.left;
        y1 = r ? r.top + 32 - origin.top : c.top + 22 - origin.top;
      }
      const x2 = h.left - origin.left - 2;
      const y2 = h.top + h.height / 2 - origin.top;
      const dx = Math.max(40, (x2 - x1) * 0.55);
      next.push({
        d: `${xStart != null ? `M ${xStart} ${y1} L ${x1} ${y1}` : `M ${x1} ${y1}`} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
        // A link is solid once the stage is truly passed: finished, and its checkpoint cleared where it has one.
        done: stage.complete && (!hasCheckpoint(stage) || stage.checkpoint.passed),
        label: anchor && xStart != null ? { x: xStart + 14, y: y1 - 7, text: t("path.yes") } : undefined,
      });
    }
    setLinks(next);
  };

  useLayoutEffect(() => {
    measureLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Start on the stage the learner is in.
  useEffect(() => {
    const el = scroller.current;
    if (el && path.currentStage != null) el.scrollLeft = Math.max(0, path.currentStage * (COLUMN + GAP) - 24);
    measureEdges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path.id]);
  useEffect(() => {
    const onResize = () => {
      measureEdges();
      measureLinks();
    };
    window.addEventListener("resize", onResize);
    // Fonts and images settle after first paint and move things a little.
    const id = window.setTimeout(measureLinks, 400);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const page = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * (COLUMN + GAP) * 1.5, behavior: "smooth" });

  return (
    <section aria-label={t("path.map")} className="relative rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 sm:px-5 py-3 border-b border-border text-[12px] text-muted-foreground">
        <span className="font-semibold text-foreground text-[13px] mr-auto">{t("path.map")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> {t("path.legend.done")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-primary" /> {t("path.legend.doing")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-border" /> {t("path.legend.todo")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rotate-45 rounded-[2px] border-2 border-border" /> {t("path.legend.checkpoint")}</span>
      </div>

      <div className="relative">
        <div
          ref={scroller}
          onScroll={measureEdges}
          role="region"
          aria-label={t("path.map")}
          tabIndex={0}
          className="overflow-auto max-h-[min(72vh,680px)] px-5 py-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 [scrollbar-width:thin]"
        >
          <div className="relative" style={{ width: "max-content" }}>
            {/* the curved links, drawn under the nodes */}
            <svg aria-hidden className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
              <defs>
                <marker id="roadmap-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                </marker>
              </defs>
              {links.map((l, i) => (
                <g key={i} className={l.done ? "text-primary" : "text-muted-foreground"}>
                  <path d={l.d} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray={l.done ? undefined : "5 5"} opacity={l.done ? 1 : 0.55} markerEnd="url(#roadmap-arrow)" />
                  {l.label && <text x={l.label.x} y={l.label.y} fontSize="10" fontWeight={600} fill="currentColor" stroke="none">{l.label.text}</text>}
                </g>
              ))}
            </svg>

            <ol ref={list} className="relative flex items-start" style={{ width: "max-content" }}>
              {path.stages.map((stage, i) => {
                const current = path.currentStage === stage.index;
                const started = stage.done > 0 || current;
                const checkpoint = hasCheckpoint(stage);
                return (
                  <li key={stage.index} className="flex items-start" data-stage={stage.index}>
                    <div style={{ width: COLUMN }} className="relative" ref={(el) => void (columns.current[i] = el)}>
                      <div className="flex items-center gap-3">
                        <span
                          ref={(el) => void (heads.current[i] = el)}
                          className={`w-11 h-11 rounded-full flex items-center justify-center text-[15px] font-bold flex-shrink-0 ${stage.complete ? "bg-primary text-white" : current ? "bg-primary/15 text-primary border-2 border-primary" : "bg-secondary text-muted-foreground border border-border"}`}
                        >
                          {stage.complete ? <Check size={18} strokeWidth={3} /> : i + 1}
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-[14px] font-semibold text-foreground leading-snug line-clamp-2">{stage.title}</h3>
                          <p className="text-[11.5px] text-muted-foreground mt-0.5">{stage.done}/{stage.total} · {formatMinutes(stage.minutes)}</p>
                          {stage.topics && stage.topics.length > 0 && <p className="text-[11px] font-mono text-primary/80 mt-0.5 truncate" title={stage.topics.join(", ")}>{stage.topics.slice(0, 4).join(" · ")}</p>}
                        </div>
                      </div>
                      <div className="relative mt-1">
                        <span aria-hidden className={`absolute left-[21px] top-0 bottom-3 w-0.5 ${started ? "bg-primary/50" : "bg-border"}`} />
                        <ul>
                          {stage.steps.map((step) => (
                            <StepNode key={step.id} step={step} onStatus={(s) => onStatus(step, s)} onOpen={() => onOpen(step)} />
                          ))}
                        </ul>
                        {checkpoint && <Checkpoint stage={stage} anchor={(el) => void (anchors.current[i] = el)} onQuiz={onQuiz} />}
                        {!checkpoint && stage.complete && (
                          <div className="pl-10 pt-1 pb-1">
                            {stage.checkpoint.passed
                              ? <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><Check size={12} className="text-primary" /> {t("quiz.passedShort", { score: stage.checkpoint.bestScore ?? 0, total: stage.checkpoint.total ?? 0 })}</span>
                              : <button onClick={() => onQuiz?.(stage)} className="inline-flex items-center gap-1.5 px-3 h-7 rounded-lg border border-primary/40 text-primary text-[12px] font-semibold hover:bg-primary/10">{stage.checkpoint.attempts > 0 ? t("quiz.tryAgain") : t("quiz.take")}</button>}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ width: GAP }} className="flex-shrink-0 relative h-11">
                      {i === path.stages.length - 1 && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" title={t("path.finished")}>
                          <Flag size={18} className={path.progress.percent === 100 ? "text-primary" : ""} />
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <div aria-hidden className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-card to-transparent transition-opacity ${edge.left ? "opacity-100" : "opacity-0"}`} />
        <div aria-hidden className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent transition-opacity ${edge.right ? "opacity-100" : "opacity-0"}`} />
        {edge.left && (
          <button onClick={() => page(-1)} aria-label={t("path.scrollLeft")} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-border bg-card shadow-md flex items-center justify-center text-foreground hover:bg-secondary"><ChevronLeft size={18} /></button>
        )}
        {edge.right && (
          <button onClick={() => page(1)} aria-label={t("path.scrollRight")} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-border bg-card shadow-md flex items-center justify-center text-foreground hover:bg-secondary"><ChevronRight size={18} /></button>
        )}
      </div>
    </section>
  );
}
