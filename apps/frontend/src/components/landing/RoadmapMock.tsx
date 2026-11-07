import { Check } from "lucide-react";

/* A small, fixed picture of the roadmap map: stage trunks, step nodes, curved links and a
   yes / not-yet checkpoint. It is drawn, not live: it shows what the real thing looks like. */

const COL = 168;
const GAP = 64;

interface Stage { title: string; steps: Array<{ label: string; kind: string; done?: boolean; doing?: boolean }>; checkpoint?: boolean }

const STAGES: Stage[] = [
  { title: "C and Unix", steps: [{ label: "Beej's Guide to C", kind: "Learn", done: true }, { label: "The Linux Command Line", kind: "Learn", done: true }, { label: "Exercism: C track", kind: "Practise", doing: true }], checkpoint: true },
  { title: "Minishell", steps: [{ label: "Unix processes", kind: "Learn" }, { label: "POSIX threads", kind: "Learn" }, { label: "Fork a process", kind: "Practise" }] },
  { title: "my_hunter", steps: [{ label: "SFML tutorials", kind: "Learn" }, { label: "Game loop patterns", kind: "Read" }] },
];

const CARD_H = 46;
const CARD_GAP = 9;
const HEAD = 44;

export function RoadmapMock({ className = "" }: { className?: string }) {
  const height = HEAD + Math.max(...STAGES.map((s) => s.steps.length)) * (CARD_H + CARD_GAP) + 70;
  const width = STAGES.length * COL + (STAGES.length - 1) * GAP;
  // From the end of each stage (its checkpoint or last node) to the next stage's number.
  const links = STAGES.slice(0, -1).map((s, i) => {
    const x1 = i * (COL + GAP) + COL;
    const y1 = HEAD + s.steps.length * (CARD_H + CARD_GAP) + (s.checkpoint ? 26 : -CARD_H / 2);
    const x2 = (i + 1) * (COL + GAP) - 2;
    const y2 = 15;
    const dx = (x2 - x1) * 0.55;
    return { d: `M ${x1 - (s.checkpoint ? COL - 14 : 0)} ${y1} L ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`, done: i === 0 };
  });

  return (
    <div className={`relative ${className}`} style={{ width, height }} aria-hidden>
      <svg width={width} height={height} className="absolute inset-0 overflow-visible">
        <defs>
          <marker id="mock-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="currentColor" /></marker>
        </defs>
        {links.map((l, i) => (
          <path key={i} d={l.d} fill="none" strokeWidth={2} stroke="currentColor" strokeDasharray={l.done ? undefined : "5 5"} className={l.done ? "text-primary" : "text-muted-foreground/60"} markerEnd="url(#mock-arrow)" />
        ))}
      </svg>
      {STAGES.map((stage, i) => (
        <div key={stage.title} className="absolute top-0" style={{ left: i * (COL + GAP), width: COL }}>
          <div className="flex items-center gap-2.5 h-[30px]">
            <span className={`w-[30px] h-[30px] rounded-full flex items-center justify-center text-[13px] font-bold ${i === 0 ? "bg-primary/15 text-primary border-2 border-primary" : "bg-secondary text-muted-foreground border border-border"}`}>{i + 1}</span>
            <span className="text-[13px] font-semibold text-foreground truncate">{stage.title}</span>
          </div>
          <span className={`absolute left-[14px] top-[34px] w-0.5 ${i === 0 ? "bg-primary/50" : "bg-border"}`} style={{ height: stage.steps.length * (CARD_H + CARD_GAP) + (stage.checkpoint ? 26 : -4) }} />
          {stage.steps.map((step, k) => (
            <div key={step.label} className="absolute" style={{ top: HEAD - 6 + k * (CARD_H + CARD_GAP), left: 0, width: COL }}>
              <span className={`absolute left-[8px] top-[16px] w-[13px] h-[13px] rounded-full border-2 bg-card ${step.done ? "!bg-primary border-primary" : step.doing ? "border-primary" : "border-border"}`} />
              <span className={`absolute left-[21px] top-[22px] w-[10px] h-0.5 ${step.done || step.doing ? "bg-primary" : "bg-border"}`} />
              <div className={`ml-[31px] rounded-lg border px-2.5 flex items-center gap-2 ${step.doing ? "border-primary/60 bg-primary/5" : step.done ? "border-border bg-secondary/60" : "border-border bg-card"}`} style={{ height: CARD_H }}>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-mono uppercase tracking-wide text-primary">{step.kind}</div>
                  <div className={`text-[11.5px] leading-tight truncate ${step.done ? "line-through text-muted-foreground" : "text-foreground font-medium"}`}>{step.label}</div>
                </div>
                <span className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${step.done ? "bg-primary border-primary text-white" : "border-border"}`}>{step.done && <Check size={10} strokeWidth={3} />}</span>
              </div>
            </div>
          ))}
          {stage.checkpoint && (
            <div className="absolute" style={{ top: HEAD - 6 + stage.steps.length * (CARD_H + CARD_GAP) + 4, left: 0, width: COL }}>
              <span className="absolute left-[4px] top-[3px] w-[20px] h-[20px] rotate-45 rounded-[4px] border-2 border-primary bg-card" />
              <span className="absolute left-[38px] top-0 text-[10.5px] font-semibold text-foreground">Ready to move on?</span>
              <span className="absolute left-[38px] top-[15px] text-[10px] text-muted-foreground">Yes · when all done</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
