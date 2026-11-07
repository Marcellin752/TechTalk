import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Brain, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { api, ReviewCard } from "../services/api";
import { ROUTES } from "../lib/routes";
import { useI18n } from "../lib/i18n";

/** Spaced review: the quiz questions that are due, one at a time. Right answers come back less and less often; wrong ones come back soon. */
export function ReviewScreen() {
  const { t } = useI18n();
  const [cards, setCards] = useState<ReviewCard[] | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [i, setI] = useState(0);
  const [feedback, setFeedback] = useState<{ chosen: number; correct: boolean; answer: number; explanation: string } | null>(null);
  const [score, setScore] = useState({ right: 0, seen: 0 });
  const [busy, setBusy] = useState(false);
  const [ownDue, setOwnDue] = useState(0);
  useEffect(() => { api.growth<{ due: unknown[] }>("/cards").then((r) => setOwnDue(r.data?.due.length ?? 0)); }, []);

  const load = useCallback(() => {
    api.getReviews().then((r) => {
      setCards(r.due);
      setDueCount(r.dueCount);
      setTotal(r.cards);
      setI(0);
      setFeedback(null);
    });
  }, []);
  useEffect(load, [load]);

  const card = cards?.[i];
  const answer = async (choice: number) => {
    if (!card || feedback || busy) return;
    setBusy(true);
    const r = await api.answerReview(card.id, choice);
    setBusy(false);
    if (!r.success || !r.result) return void toast.error(r.error || t("admin.error"));
    setFeedback({ chosen: choice, correct: r.result.correct, answer: r.result.answer, explanation: r.result.explanation });
    setScore((s) => ({ right: s.right + (r.result!.correct ? 1 : 0), seen: s.seen + 1 }));
  };
  const next = () => {
    setFeedback(null);
    if (cards && i + 1 < cards.length) setI(i + 1);
    else load();
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-16">
        <div className="text-center mb-8">
          <span className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto"><Brain size={24} /></span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-3">{t("review.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">{t("review.subtitle")}</p>
        </div>

        {ownDue > 0 && (
          <p className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm text-foreground mb-5 flex items-center gap-3">
            <span className="flex-1">{t("review.cardsDue", { n: ownDue })}</span><Link to="/memory" className="font-semibold text-primary">{t("review.goMemory")}</Link>
          </p>
        )}
        {cards === null && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>}

        {cards && !card && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <span className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto"><Check size={26} strokeWidth={3} /></span>
            <h2 className="text-lg font-semibold text-foreground mt-4">{total === 0 ? t("review.none") : t("review.caughtUp")}</h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">{total === 0 ? t("review.noneText") : t("review.caughtUpText", { n: total })}</p>
            {score.seen > 0 && <p className="text-[13px] text-foreground mt-4 font-medium">{t("review.sessionScore", { right: score.right, seen: score.seen })}</p>}
            <Link to={ROUTES.path} className="inline-flex items-center px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold mt-5">{t("nav.path")}</Link>
          </div>
        )}

        {card && (
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between text-[12px] text-muted-foreground mb-4">
              <span className="font-mono uppercase tracking-wide">{card.topic || t("review.title")}</span>
              <span>{t("review.progress", { n: i + 1, total: cards.length, due: dueCount })}</span>
            </div>
            <h2 className="text-[17px] font-semibold text-foreground leading-snug">{card.question}</h2>
            <div role="radiogroup" aria-label={card.question} className="mt-4 space-y-2">
              {card.options.map((o, k) => {
                const isAnswer = feedback && k === feedback.answer;
                const isWrongPick = feedback && k === feedback.chosen && !feedback.correct;
                return (
                  <button key={k} role="radio" aria-checked={feedback?.chosen === k} disabled={!!feedback || busy} onClick={() => answer(k)} className={`w-full text-left rounded-xl border px-4 py-3 text-[14px] transition-colors ${isAnswer ? "border-emerald-500 bg-emerald-500/10" : isWrongPick ? "border-red-500 bg-red-500/10" : "border-border hover:border-primary/50"} disabled:cursor-default`}>
                    <span className="font-mono text-[11px] text-muted-foreground mr-2">{String.fromCharCode(65 + k)}</span>{o}
                    {isAnswer && <Check size={15} className="inline ml-2 text-emerald-600" />}
                    {isWrongPick && <X size={15} className="inline ml-2 text-red-600" />}
                  </button>
                );
              })}
            </div>
            {feedback && (
              <div className="mt-4" aria-live="polite">
                <p className={`text-[14px] font-semibold ${feedback.correct ? "text-emerald-600" : "text-red-600"}`}>{feedback.correct ? t("review.right") : t("review.wrong")}</p>
                {feedback.explanation && <p className="text-[13.5px] text-muted-foreground mt-1 leading-relaxed">{feedback.explanation}</p>}
                <button onClick={next} className="mt-4 px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold">{t("review.next")}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
