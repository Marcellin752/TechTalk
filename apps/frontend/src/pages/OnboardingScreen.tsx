import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, Rss } from "lucide-react";
import { toast } from "sonner";
import { api, LearningGoal, LearningLevel, LearningProfile, LearningStyle } from "../services/api";
import { DEFAULT_LANGUAGES, GOAL_IDS, GOAL_INTERESTS, HOURS_OPTIONS, LANGUAGE_OPTIONS, LEVEL_IDS, STYLE_IDS } from "../lib/learning";
import { useI18n } from "../lib/i18n";
import type { Keys } from "../locales/en";
import { ROUTES } from "../lib/routes";

/* Five questions at the start; the answers shape the learning path and the feed. */

const STEPS = ["onb.step.goal", "onb.step.level", "onb.step.languages", "onb.step.time", "onb.step.style"] as const;

function Option({ selected, onClick, title, text }: { selected: boolean; onClick: () => void; title: string; text?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`relative text-left rounded-xl border p-4 transition-colors ${selected ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40 hover:bg-secondary/50"}`}
    >
      <span className="block text-[15px] font-semibold text-foreground pr-6">{title}</span>
      {text && <span className="block text-[13px] text-muted-foreground mt-1 leading-snug">{text}</span>}
      {selected && (
        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

export function OnboardingScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editing = params.get("edit") === "1";

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<LearningGoal | null>(null);
  const [level, setLevel] = useState<LearningLevel | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const [languagesTouched, setLanguagesTouched] = useState(false);
  const [hours, setHours] = useState<number | null>(null);
  const [style, setStyle] = useState<LearningStyle | null>(null);
  const [building, setBuilding] = useState(false);
  const [loading, setLoading] = useState(editing);

  // Editing: start from what was chosen before.
  useEffect(() => {
    if (!editing) return;
    api
      .getLearningProfile()
      .then((p) => {
        if (!p) return;
        setGoal(p.goal);
        setLevel(p.level);
        setLanguages(p.languages);
        setLanguagesTouched(true);
        setHours(p.hoursPerWeek);
        setStyle(p.style);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [editing]);

  // Suggest languages that fit the goal until the learner picks their own.
  useEffect(() => {
    if (goal && !languagesTouched) setLanguages(DEFAULT_LANGUAGES[goal]);
  }, [goal, languagesTouched]);

  const toggleLanguage = (l: string) => {
    setLanguagesTouched(true);
    setLanguages((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : prev.length >= 5 ? prev : [...prev, l]));
  };

  const canContinue = [!!goal, !!level, languages.length > 0, !!hours, !!style][step]!;
  const last = step === STEPS.length - 1;

  const skip = () => {
    try {
      localStorage.setItem("teachtalk_onboarding_skipped", "1");
    } catch {
      /* the prompt may show again next time */
    }
    navigate(ROUTES.home, { replace: true });
  };

  const build = async () => {
    if (!goal || !level || !hours || !style) return;
    const profile: LearningProfile = { goal, level, languages, hoursPerWeek: hours, style };
    setBuilding(true);
    const res = await api.saveLearningProfile(profile);
    if (!res.success) {
      setBuilding(false);
      toast.error(res.error || t("onb.buildError"));
      return;
    }
    try {
      // The feed follows the goal too.
      localStorage.setItem("teachtalk_interests", JSON.stringify(GOAL_INTERESTS[goal]));
      localStorage.removeItem("teachtalk_onboarding_skipped");
    } catch {
      /* the feed topics can still be set in Settings */
    }
    navigate(ROUTES.path, { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (building) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 text-center px-6">
        <Loader2 size={32} className="animate-spin text-primary" />
        <h1 className="text-xl font-bold text-foreground">{t("onb.building")}</h1>
        <p className="text-sm text-muted-foreground max-w-sm">{t("onb.buildingText")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between px-5 sm:px-8 h-16">
        <span className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/30">
            <Rss size={13} className="text-white" />
          </span>
          <span className="text-[18px] font-bold tracking-tight text-foreground">TechTalk</span>
        </span>
        <button onClick={editing ? () => navigate(-1) : skip} className="text-sm text-muted-foreground hover:text-foreground">
          {editing ? t("common.cancel") : t("onb.skip")}
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center px-5 pb-10">
        <div className="w-full max-w-2xl pt-4 sm:pt-10">
          <div className="flex items-center gap-1.5 mb-8" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Step">
            {STEPS.map((label, i) => (
              <div key={label} className="flex-1">
                <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-secondary"}`} />
                <span className={`hidden sm:block text-[11px] font-mono mt-1.5 ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{t(label)}</span>
              </div>
            ))}
          </div>

          {step === 0 && (
            <section>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t("onb.goal.title")}</h1>
              <p className="text-muted-foreground mt-2">{t("onb.goal.text")}</p>
              <div role="radiogroup" aria-label="Goal" className="grid sm:grid-cols-2 gap-3 mt-6">
                {GOAL_IDS.map((id) => (
                  <Option key={id} selected={goal === id} onClick={() => setGoal(id)} title={t(`goal.${id}` as Keys)} text={t(`goal.${id}.text` as Keys)} />
                ))}
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t("onb.level.title")}</h1>
              <p className="text-muted-foreground mt-2">{t("onb.level.text")}</p>
              <div role="radiogroup" aria-label="Level" className="grid sm:grid-cols-2 gap-3 mt-6">
                {LEVEL_IDS.map((id) => (
                  <Option key={id} selected={level === id} onClick={() => setLevel(id)} title={t(`lvl.${id}` as Keys)} text={t(`lvl.${id}.text` as Keys)} />
                ))}
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t("onb.lang.title")}</h1>
              <p className="text-muted-foreground mt-2">{t("onb.lang.text")}</p>
              <div className="flex flex-wrap gap-2.5 mt-6">
                {LANGUAGE_OPTIONS.map((l) => {
                  const on = languages.includes(l);
                  return (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleLanguage(l)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${on ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground hover:border-primary/40"}`}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t("onb.time.title")}</h1>
              <p className="text-muted-foreground mt-2">{t("onb.time.text")}</p>
              <div role="radiogroup" aria-label="Hours per week" className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
                {HOURS_OPTIONS.map((h) => (
                  <Option key={h} selected={hours === h} onClick={() => setHours(h)} title={`${h} h`} text={t(`hours.${h}` as Keys)} />
                ))}
              </div>
            </section>
          )}

          {step === 4 && (
            <section>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t("onb.style.title")}</h1>
              <p className="text-muted-foreground mt-2">{t("onb.style.text")}</p>
              <div role="radiogroup" aria-label="Learning style" className="grid sm:grid-cols-2 gap-3 mt-6">
                {STYLE_IDS.map((id) => (
                  <Option key={id} selected={style === id} onClick={() => setStyle(id)} title={t(`style.${id}` as Keys)} text={t(`style.${id}.text` as Keys)} />
                ))}
              </div>
            </section>
          )}

          <div className="flex items-center justify-between mt-10">
            <button onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="inline-flex items-center gap-2 px-4 h-11 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-0">
              <ArrowLeft size={16} /> {t("common.back")}
            </button>
            <button
              onClick={last ? build : () => setStep((s) => s + 1)}
              disabled={!canContinue}
              className="inline-flex items-center gap-2 px-6 h-11 rounded-xl bg-primary text-white text-sm font-semibold shadow-md shadow-primary/25 disabled:opacity-40 disabled:shadow-none"
            >
              {last ? (editing ? t("onb.rebuild") : t("onb.build")) : t("common.continue")} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
