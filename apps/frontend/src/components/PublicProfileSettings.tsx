import { useEffect, useState } from "react";
import { Check, ExternalLink, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { api, ProfileSettings } from "../services/api";
import { useI18n } from "../lib/i18n";
import { SITE_URL } from "../lib/seo";

function Switch({ checked, onChange, label, text, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; text?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 py-2.5 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 w-10 h-6 rounded-full flex-shrink-0 transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </button>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-foreground">{label}</span>
        {text && <span className="block text-[12.5px] text-muted-foreground mt-0.5">{text}</span>}
      </span>
    </label>
  );
}

/** Who can see what. Private by default; each switch saves on its own. */
export function PublicProfileSettings() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<ProfileSettings | null>(null);
  const [suggested, setSuggested] = useState("");
  const [handle, setHandle] = useState("");
  const [check, setCheck] = useState<{ available: boolean; reason: string | null } | null>(null);

  useEffect(() => {
    api
      .getProfileSettings()
      .then((r) => {
        setSettings(r.settings);
        setHandle(r.settings.handle ?? "");
        setSuggested(r.suggestedHandle);
      })
      .catch(() => undefined);
  }, []);

  // Is the typed name free? Asked as the learner types.
  useEffect(() => {
    const value = handle.trim().toLowerCase();
    if (!settings || !value || value === settings.handle) {
      setCheck(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api.checkHandle(value).then((r) => !cancelled && setCheck(r)).catch(() => undefined);
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [handle, settings]);

  if (!settings) return <div className="h-40 rounded-xl bg-secondary animate-pulse max-w-lg" />;

  const save = async (patch: Partial<ProfileSettings>) => {
    const res = await api.saveProfileSettings(patch);
    if (res.success && res.settings) {
      setSettings(res.settings);
      setHandle(res.settings.handle ?? "");
      setCheck(null);
      toast.success(t("set.public.saved"));
      return true;
    }
    toast.error(res.error || t("path.saveError"));
    return false;
  };

  const url = `${SITE_URL}/u/${settings.handle ?? handle.trim().toLowerCase() ?? "…"}`;
  const handleChanged = handle.trim().toLowerCase() !== (settings.handle ?? "");

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5" htmlFor="handle">{t("set.public.handle")}</label>
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">@</span>
            <input
              id="handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              maxLength={30}
              autoCapitalize="none"
              spellCheck={false}
              className="w-full h-10 rounded-xl bg-secondary border border-border pl-7 pr-9 text-sm font-mono text-foreground focus:outline-none focus:border-primary"
            />
            {check && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2" title={check.reason ?? t("set.public.available")}>
                {check.available ? <Check size={16} className="text-emerald-500" /> : <X size={16} className="text-destructive" />}
              </span>
            )}
          </div>
          <button onClick={() => save({ handle: handle.trim().toLowerCase() })} disabled={!handleChanged || !handle.trim() || (check !== null && !check.available)} className="px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40">
            {t("common.save")}
          </button>
        </div>
        {check && !check.available && <p className="text-[12px] text-destructive mt-1.5">{check.reason ?? t("set.public.taken")}</p>}
        {!settings.handle && suggested && !handle && (
          <button onClick={() => setHandle(suggested)} className="text-[12.5px] text-primary hover:underline mt-1.5">{t("set.public.suggest", { name: suggested })}</button>
        )}
        {settings.handle && <p className="text-[12px] text-muted-foreground mt-1.5 font-mono break-all">{t("set.public.handleHint", { url })}</p>}
      </div>

      <div className="rounded-xl border border-border divide-y divide-border px-4">
        <Switch
          checked={settings.isPublic}
          onChange={(v) => (v && !settings.handle ? toast.error(t("set.public.needHandle")) : void save({ isPublic: v }))}
          label={t("set.public.on")}
          text={t("set.public.onText")}
        />
        <Switch checked={settings.showProjects} onChange={(v) => void save({ showProjects: v })} label={t("set.public.projects")} disabled={!settings.isPublic} />
        <Switch checked={settings.showInterests} onChange={(v) => void save({ showInterests: v })} label={t("set.public.interests")} disabled={!settings.isPublic} />
        <Switch checked={settings.pathPublic} onChange={(v) => void save({ pathPublic: v })} label={t("set.public.path")} text={t("set.public.pathText")} disabled={!settings.isPublic} />
      </div>

      {settings.isPublic && settings.handle && (
        <div className="flex flex-wrap gap-3">
          <a href={`/u/${settings.handle}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary">
            <ExternalLink size={15} /> {t("set.public.view")}
          </a>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                toast.success(t("common.copied"));
              } catch {
                /* clipboard unavailable */
              }
            }}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary"
          >
            <Link2 size={15} /> {t("common.copy")}
          </button>
        </div>
      )}
    </div>
  );
}
