import { ArrowRight, Route, Sparkles } from "lucide-react";
import type { LearningPath } from "../services/api";
import { formatMinutes, typeLabel } from "../lib/learning";
import { useI18n } from "../lib/i18n";

/** Top of the home feed: pick the path up where it was left, or offer to start one. */
export function ContinueBand({ path, hasProfile, onOpenPath, onStart }: { path: LearningPath | null | undefined; hasProfile: boolean; onOpenPath?: () => void; onStart?: () => void }) {
  const { t } = useI18n();
  if (!path) {
    // A learner who skipped the questions gets a gentle invitation, never a wall.
    return hasProfile ? null : (
      <button onClick={onStart} className="w-full text-left flex items-center gap-4 rounded-2xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors p-4 mb-5">
        <span className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
          <Sparkles size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-foreground">{t("continue.getPath")}</span>
          <span className="block text-[13px] text-muted-foreground">{t("continue.getPathText")}</span>
        </span>
        <ArrowRight size={18} className="text-primary flex-shrink-0" />
      </button>
    );
  }

  const next = path.next;
  const finished = !next;
  const stage = path.currentStage != null ? path.stages[path.currentStage] : null;

  return (
    <button onClick={onOpenPath} className="w-full text-left flex items-center gap-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent hover:border-primary/60 transition-colors p-4 mb-5">
      <span className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
        <Route size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-mono uppercase tracking-wide text-primary">
          {finished ? t("continue.complete") : `${t("continue.title")}${stage ? ` · ${t("continue.stageOf", { n: stage.index + 1, total: path.stages.length })}` : ""}`}
        </span>
        <span className="block text-[15px] font-semibold text-foreground truncate mt-0.5">{finished ? path.title : next!.content.title}</span>
        <span className="flex items-center gap-3 mt-1.5">
          <span className="h-1.5 w-32 sm:w-48 rounded-full bg-secondary overflow-hidden">
            <span className="block h-full bg-primary rounded-full" style={{ width: `${path.progress.percent}%` }} />
          </span>
          <span className="text-[12px] text-muted-foreground">
            {path.progress.percent}%{next ? ` · ${typeLabel(t, next.content.type)} · ${formatMinutes(next.minutes)}` : ""}
          </span>
        </span>
      </span>
      <span className="hidden sm:inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-primary text-white text-sm font-semibold flex-shrink-0">
        {finished ? t("continue.review") : t("continue.go")} <ArrowRight size={14} />
      </span>
    </button>
  );
}
