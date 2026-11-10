import { useEffect, useState } from "react";
import { GraduationCap, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { api, LearningPath, LearningProfile, PathSummary, SchoolPreset } from "../services/api";
import { useI18n } from "../lib/i18n";

const field = "w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary";
const MAX_TOPICS = 8;

function SchoolDialog({ profile, onClose, onSaved }: { profile: LearningProfile; onClose: () => void; onSaved: (p: LearningProfile, path: LearningPath | null, paths: PathSummary[]) => void }) {
  const { t } = useI18n();
  const [presets, setPresets] = useState<SchoolPreset[]>([]);
  const [school, setSchool] = useState(profile.school ?? "");
  const [year, setYear] = useState<number | null>(profile.schoolYear ?? null);
  const [topics, setTopics] = useState<string[]>(profile.schoolTopics ?? []);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [shareReco, setShareReco] = useState(!!profile.shareForRecommendations);
  const [shareSchool, setShareSchool] = useState(!!profile.shareWithSchool);

  useEffect(() => {
    api.getSchools().then(setPresets).catch(() => undefined);
  }, []);

  const preset = presets.find((p) => p.name.toLowerCase() === school.trim().toLowerCase());
  const partner = !!preset?.partner;
  const suggestions = (preset && year ? preset.years[Math.min(year, preset.years.length) - 1] : null)?.filter((s) => !topics.includes(s)) ?? [];

  const add = (raw: string) => {
    const value = raw.trim().toLowerCase();
    if (!value || topics.includes(value) || topics.length >= MAX_TOPICS) return;
    setTopics((cur) => [...cur, value]);
  };
  const commitDraft = () => {
    // Commas also separate topics, so "c, unix" can be pasted in one go.
    draft.split(",").forEach(add);
    setDraft("");
  };

  const save = async (clear = false) => {
    // Anything typed but not yet added still counts.
    const pending = draft.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const finalTopics = [...new Set([...topics, ...pending])].slice(0, MAX_TOPICS);
    if (!clear) {
      if (!school.trim()) return void toast.error(t("school.needName"));
      if (finalTopics.length === 0) return void toast.error(t("school.needTopic"));
    }
    setBusy(true);
    const res = await api.setSchool(clear ? { school: "", schoolYear: null, schoolTopics: [] } : { school: school.trim(), schoolYear: year, schoolTopics: finalTopics, shareForRecommendations: shareReco, shareWithSchool: partner && shareSchool });
    setBusy(false);
    if (!res.success) return void toast.error(res.error || t("admin.error"));
    toast.success(clear ? t("school.removed") : t("school.saved"));
    onSaved(res.profile ?? profile, res.path, res.paths);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:px-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={t("school.title")}>
      <div className="bg-card border border-border sm:rounded-2xl rounded-t-2xl w-full max-w-lg max-h-[92dvh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-lg font-semibold text-foreground">{t("school.title")}</h2>
          <button onClick={onClose} aria-label={t("common.cancel")} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("school.name")}</span>
            <input value={school} onChange={(e) => setSchool(e.target.value)} list="school-presets" maxLength={80} placeholder={t("school.namePlaceholder")} className={field} autoFocus />
            <datalist id="school-presets">{presets.map((p) => <option key={p.id} value={p.name} />)}</datalist>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("school.year")}</span>
            <select value={year ?? ""} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)} className={field}>
              <option value="">{t("school.noYear")}</option>
              {Array.from({ length: 8 }, (_, i) => i + 1).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>

          <div>
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("school.topics")}</span>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {topics.map((tp) => (
                <span key={tp} className="inline-flex items-center gap-1 pl-2.5 pr-1 h-7 rounded-full bg-primary/10 text-primary text-[13px]">
                  {tp}
                  <button onClick={() => setTopics((cur) => cur.filter((x) => x !== tp))} aria-label={`${t("cal.delete")} ${tp}`} className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-primary/20"><X size={12} /></button>
                </span>
              ))}
            </div>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  commitDraft();
                }
              }}
              onBlur={commitDraft}
              maxLength={40}
              disabled={topics.length >= MAX_TOPICS}
              placeholder={t("school.topicPlaceholder")}
              className={field}
            />
            <p className="text-[12px] text-muted-foreground mt-1.5">{t("school.topicsHelp")}</p>
            {suggestions.length > 0 && (
              <div className="mt-3">
                <span className="text-[12px] text-muted-foreground">{t("school.suggested")}</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => add(s)} className="px-2.5 h-7 rounded-full border border-border text-[13px] text-foreground hover:border-primary hover:bg-primary/5">+ {s}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-4 space-y-2.5">
          <p className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{t("data.title")}</p>
          <label className="flex items-start gap-2.5 text-[13px] text-foreground cursor-pointer">
            <input type="checkbox" checked={shareReco} onChange={(e) => setShareReco(e.target.checked)} className="mt-0.5 accent-[var(--primary)]" />
            <span>{t("data.reco.title")}<span className="block text-[12px] text-muted-foreground">{t("data.reco.text")}</span></span>
          </label>
          {partner && (
            <label className="flex items-start gap-2.5 text-[13px] text-foreground cursor-pointer">
              <input type="checkbox" checked={shareSchool} onChange={(e) => setShareSchool(e.target.checked)} className="mt-0.5 accent-[var(--primary)]" />
              <span>{t("data.school.title", { school: school.trim() })}<span className="block text-[12px] text-muted-foreground">{t("data.school.text")}</span></span>
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-5">
          {profile.school ? (
            <button onClick={() => save(true)} disabled={busy} className="text-[13px] text-muted-foreground hover:text-destructive">{t("school.remove")}</button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 h-10 rounded-xl border border-border text-sm text-foreground hover:bg-secondary">{t("common.cancel")}</button>
            <button onClick={() => save()} disabled={busy} className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60">{t("school.apply")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** On the path page: where the learner studies, and a way to line the path up with it. */
export function SchoolCard({ profile, onUpdated }: { profile: LearningProfile | null; onUpdated: (profile: LearningProfile, path: LearningPath | null, paths: PathSummary[]) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!profile) return null;

  return (
    <>
      <section className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"><GraduationCap size={20} /></span>
        <div className="min-w-0 flex-1">
          {profile.school ? (
            <>
              <h2 className="text-[15px] font-semibold text-foreground">
                {profile.schoolYear ? t("school.at", { school: profile.school, year: profile.schoolYear }) : t("school.atNoYear", { school: profile.school })}
              </h2>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(profile.schoolTopics ?? []).map((tp) => <span key={tp} className="px-2.5 h-6 inline-flex items-center rounded-full bg-secondary text-[12px] text-foreground">{tp}</span>)}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-[15px] font-semibold text-foreground">{t("school.title")}</h2>
              <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{t("school.text")}</p>
            </>
          )}
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary flex-shrink-0">
          {profile.school ? <><Pencil size={14} /> {t("school.edit")}</> : t("school.cta")}
        </button>
      </section>
      {open && <SchoolDialog profile={profile} onClose={() => setOpen(false)} onSaved={onUpdated} />}
    </>
  );
}
