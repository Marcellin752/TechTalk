import { useState } from "react";
import { GraduationCap, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { api, LearningPath, LearningProfile, PathSummary } from "../services/api";
import { Modal } from "./Modal";
import { useI18n } from "../lib/i18n";
import { DEFAULT_LANGUAGES, GOAL_IDS, HOURS_OPTIONS, LEVEL_IDS, STYLE_IDS } from "../lib/learning";
import type { Keys } from "../locales/en";

const field = "w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary";
type Kind = "school" | "personal" | "custom";

/** Make another path: for school (a year of the programme), a personal one, or anything you want to learn. */
export function NewPathDialog({ profile, paths, onClose, onCreated }: { profile: LearningProfile | null; paths: PathSummary[]; onClose: () => void; onCreated: (path: LearningPath) => void }) {
  const { t } = useI18n();
  const hasPersonal = paths.some((p) => p.kind === "personal");
  const hasSchool = !!profile?.school;
  const [kind, setKind] = useState<Kind>(hasSchool ? "school" : hasPersonal ? "custom" : "personal");
  const takenYears = new Set(paths.filter((p) => p.kind === "school").map((p) => p.schoolYear ?? 1));
  const firstFree = [1, 2, 3, 4, 5, 6, 7, 8].find((y) => !takenYears.has(y)) ?? 1;
  const [year, setYear] = useState(profile?.schoolYear && !takenYears.has(profile.schoolYear) ? profile.schoolYear : firstFree);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState(profile?.goal ?? "backend");
  const [level, setLevel] = useState(profile?.level ?? "beginner");
  const [style, setStyle] = useState(profile?.style ?? "mixed");
  const [hours, setHours] = useState(profile?.hoursPerWeek ?? 5);
  const [busy, setBusy] = useState(false);

  const options: Array<{ id: Kind; icon: typeof User; disabled: boolean; hint?: string }> = [
    { id: "school", icon: GraduationCap, disabled: !hasSchool, hint: hasSchool ? undefined : t("paths.needSchool") },
    { id: "personal", icon: User, disabled: hasPersonal, hint: hasPersonal ? t("paths.havePersonal") : undefined },
    { id: "custom", icon: Sparkles, disabled: false },
  ];

  const create = async () => {
    if (kind === "custom" && title.trim().length < 2) return void toast.error(t("paths.needName"));
    setBusy(true);
    const res = await api.createPath(
      kind === "school" ? { kind, schoolYear: year, ...(title.trim() ? { title: title.trim() } : {}) }
        : kind === "personal" ? { kind }
        : { kind, title: title.trim(), goal, level, style, hoursPerWeek: hours, languages: DEFAULT_LANGUAGES[goal as keyof typeof DEFAULT_LANGUAGES] ?? [] },
    );
    setBusy(false);
    if (!res.success || !res.path) return void toast.error(res.error || t("path.saveError"));
    toast.success(t("paths.created"));
    onCreated(res.path);
    onClose();
  };

  return (
    <Modal title={t("paths.newTitle")} onClose={onClose} wide>
      <div className="px-5 py-4 space-y-4">
        <div role="radiogroup" aria-label={t("paths.kindLabel")} className="grid sm:grid-cols-3 gap-2.5">
          {options.map((o) => (
            <button key={o.id} role="radio" aria-checked={kind === o.id} disabled={o.disabled} onClick={() => setKind(o.id)} className={`text-left rounded-xl border p-3 transition-colors disabled:opacity-45 ${kind === o.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}>
              <o.icon size={18} className={kind === o.id ? "text-primary" : "text-muted-foreground"} />
              <span className="block text-[14px] font-semibold text-foreground mt-1.5">{t(`paths.kind.${o.id}`)}</span>
              <span className="block text-[12px] text-muted-foreground mt-0.5 leading-snug">{o.hint ?? t(`paths.kind.${o.id}.text` as Keys)}</span>
            </button>
          ))}
        </div>

        {kind === "school" && (
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("paths.programmeYear", { school: profile?.school ?? "" })}</span>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={field}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((y) => <option key={y} value={y} disabled={takenYears.has(y)}>{t("campus.yearN", { n: y })}{takenYears.has(y) ? ` (${t("paths.alreadyHave")})` : ""}</option>)}
            </select>
          </label>
        )}

        {kind === "custom" && (
          <>
            <label className="block">
              <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("paths.name")}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder={t("paths.namePh")} className={field} autoFocus />
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("paths.goal")}</span>
                <select value={goal} onChange={(e) => setGoal(e.target.value as typeof goal)} className={field}>{GOAL_IDS.map((g) => <option key={g} value={g}>{t(`goal.${g}` as Keys)}</option>)}</select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("paths.level")}</span>
                <select value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className={field}>{LEVEL_IDS.map((l) => <option key={l} value={l}>{t(`lvl.${l}` as Keys)}</option>)}</select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("paths.style")}</span>
                <select value={style} onChange={(e) => setStyle(e.target.value as typeof style)} className={field}>{STYLE_IDS.map((s) => <option key={s} value={s}>{t(`style.${s}` as Keys)}</option>)}</select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("paths.hours")}</span>
                <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className={field}>{HOURS_OPTIONS.map((h) => <option key={h} value={h}>{h} h</option>)}</select>
              </label>
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 px-5 pb-5">
        <button onClick={onClose} className="px-4 h-10 rounded-xl border border-border text-sm text-foreground hover:bg-secondary">{t("common.cancel")}</button>
        <button onClick={create} disabled={busy} className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60">{busy ? t("auth.wait") : t("paths.create")}</button>
      </div>
    </Modal>
  );
}
