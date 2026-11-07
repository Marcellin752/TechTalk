import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, LearningProfile } from "../services/api";
import { useI18n } from "../lib/i18n";

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors disabled:opacity-40 ${checked ? "bg-primary" : "bg-switch-background"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

/** The two choices about learning data. Both start off, and each can be turned off again at any time. */
export function DataSharing() {
  const { t } = useI18n();
  const [profile, setProfile] = useState<LearningProfile | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getLearningProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  if (profile === undefined) return <div className="h-16 rounded-xl bg-secondary animate-pulse" />;
  if (!profile) return <p className="text-sm text-muted-foreground">{t("data.needPath")}</p>;

  const toggle = async (key: "shareWithSchool" | "shareForRecommendations", value: boolean) => {
    setBusy(true);
    const res = await api.setConsent({ [key]: value });
    setBusy(false);
    if (!res.success || !res.profile) return void toast.error(res.error || t("admin.error"));
    setProfile(res.profile);
    toast.success(value ? t("data.on") : t("data.off"));
  };

  const hasPartnerSchool = !!profile.schoolId;
  const rows: Array<{ key: "shareForRecommendations" | "shareWithSchool"; title: string; text: string; disabled: boolean; hint?: string }> = [
    { key: "shareForRecommendations", title: t("data.reco.title"), text: t("data.reco.text"), disabled: false },
    {
      key: "shareWithSchool",
      title: t("data.school.title", { school: profile.school ?? "" }),
      text: t("data.school.text"),
      disabled: !hasPartnerSchool,
      hint: !profile.school ? t("data.school.none") : !hasPartnerSchool ? t("data.school.notPartner") : undefined,
    },
  ];

  return (
    <div className="space-y-5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">{r.title}</div>
            <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{r.text}</p>
            {r.hint && <p className="text-[12px] text-muted-foreground mt-1 italic">{r.hint}</p>}
          </div>
          <Switch checked={!!profile[r.key]} onChange={(v) => toggle(r.key, v)} disabled={busy || r.disabled} label={r.title} />
        </div>
      ))}
      <p className="text-[12px] text-muted-foreground leading-relaxed border-t border-border pt-4">{t("data.promise")}</p>
    </div>
  );
}
