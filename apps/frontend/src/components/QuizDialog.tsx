import { useEffect, useState } from "react";
import { Check, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { api, LearningPath, QuizResult, QuizView } from "../services/api";
import { Modal } from "./Modal";
import { KairosFace } from "./KairosArt";
import { useI18n } from "../lib/i18n";

interface Props {
  pathId: string;
  stage: number;
  stageTitle: string;
  onClose: () => void;
  /** The path as it is after the attempt (the checkpoint may now be passed). */
  onDone: (path: LearningPath) => void;
}

/** The checkpoint quiz of a finished stage: Kairos writes it, the learner answers, it is graded with an explanation for each question. */
export function QuizDialog({ pathId, stage, stageTitle, onClose, onDone }: Props) {
  const { t } = useI18n();
  const [quiz, setQuiz] = useState<QuizView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getQuiz(pathId, stage).then((r) => {
      if (cancelled) return;
      if (!r.success || !r.quiz) return setError(r.error || t("admin.error"));
      setQuiz(r.quiz);
      setAnswers(r.quiz.questions.map(() => null));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathId, stage]);

  const submit = async () => {
    if (!quiz) return;
    setBusy(true);
    const r = await api.submitQuiz(quiz.quizId, answers);
    setBusy(false);
    if (!r.success || !r.result) return void toast.error(r.error || t("admin.error"));
    setResult(r.result);
    onDone(r.result.path);
  };

  const retake = async () => {
    if (!quiz) return;
    setBusy(true);
    const r = await api.renewQuiz(quiz.quizId);
    setBusy(false);
    if (!r.success || !r.quiz) return void toast.error(r.error || t("admin.error"));
    setQuiz(r.quiz);
    setAnswers(r.quiz.questions.map(() => null));
    setResult(null);
  };

  const answered = answers.filter((a) => a !== null).length;
  return (
    <Modal title={t("quiz.title", { stage: stageTitle })} onClose={onClose} wide>
      <div className="px-5 py-4">
        {!quiz && !error && (
          <div className="py-10 flex flex-col items-center gap-3 text-center" role="status">
            <KairosFace size={48} />
            <p className="text-sm text-muted-foreground">{t("quiz.writing")}</p>
            <Loader2 className="animate-spin text-primary" size={20} />
          </div>
        )}
        {error && (
          <div className="py-8 text-center space-y-3">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            <button onClick={onClose} className="px-4 h-10 rounded-xl border border-border text-sm text-foreground hover:bg-secondary">{t("common.cancel")}</button>
          </div>
        )}

        {quiz && !result && (
          <>
            <p className="text-[13px] text-muted-foreground mb-4">{t("quiz.intro", { n: quiz.questions.length })}</p>
            <ol className="space-y-5">
              {quiz.questions.map((q, i) => (
                <li key={i}>
                  <p className="text-[14.5px] font-semibold text-foreground leading-snug">{i + 1}. {q.question}</p>
                  <div role="radiogroup" aria-label={q.question} className="mt-2 space-y-1.5">
                    {q.options.map((o, k) => (
                      <button key={k} role="radio" aria-checked={answers[i] === k} onClick={() => setAnswers((a) => a.map((x, j) => (j === i ? k : x)))} className={`w-full text-left rounded-xl border px-3.5 py-2.5 text-[13.5px] transition-colors ${answers[i] === k ? "border-primary bg-primary/10 text-foreground" : "border-border text-foreground/90 hover:border-primary/50"}`}>
                        <span className="font-mono text-[11px] text-muted-foreground mr-2">{String.fromCharCode(65 + k)}</span>{o}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-between gap-3 mt-6">
              <span className="text-[12.5px] text-muted-foreground">{t("quiz.answered", { done: answered, total: quiz.questions.length })}</span>
              <button onClick={submit} disabled={busy || answered === 0} className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50">{busy ? t("auth.wait") : t("quiz.submit")}</button>
            </div>
          </>
        )}

        {quiz && result && (
          <>
            <div className={`rounded-2xl p-4 flex items-center gap-3 ${result.passed ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-amber-500/10 border border-amber-500/30"}`}>
              <span className={`w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0 ${result.passed ? "bg-emerald-500" : "bg-amber-500"}`}>{result.passed ? <Check size={22} strokeWidth={3} /> : <RotateCcw size={20} />}</span>
              <div>
                <p className="text-[16px] font-bold text-foreground">{result.passed ? t("quiz.passed") : t("quiz.notYet")} · {result.score}/{result.total}</p>
                <p className="text-[13px] text-muted-foreground">{result.passed ? t("quiz.passedText") : t("quiz.notYetText")}</p>
              </div>
            </div>
            <ol className="space-y-4 mt-5">
              {quiz.questions.map((q, i) => {
                const r = result.results[i]!;
                return (
                  <li key={i} className="rounded-xl border border-border p-3.5">
                    <p className="text-[14px] font-semibold text-foreground leading-snug flex gap-2">
                      <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white ${r.correct ? "bg-emerald-500" : "bg-red-500"}`}>{r.correct ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}</span>
                      {q.question}
                    </p>
                    {!r.correct && r.chosen !== null && <p className="text-[13px] text-red-600 dark:text-red-400 mt-2">{t("quiz.yourAnswer")}: {q.options[r.chosen]}</p>}
                    <p className="text-[13px] text-emerald-700 dark:text-emerald-400 mt-1">{t("quiz.correctAnswer")}: {q.options[r.answer]}</p>
                    {r.explanation && <p className="text-[13px] text-muted-foreground mt-1.5 leading-relaxed">{r.explanation}</p>}
                  </li>
                );
              })}
            </ol>
            <p className="text-[12px] text-muted-foreground mt-4">{t("quiz.reviewNote")}</p>
            <div className="flex justify-end gap-2 mt-4">
              {!result.passed && <button onClick={retake} disabled={busy} className="px-4 h-10 rounded-xl border border-border text-sm text-foreground hover:bg-secondary disabled:opacity-60">{t("quiz.retake")}</button>}
              <button onClick={onClose} className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold">{t("quiz.close")}</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
