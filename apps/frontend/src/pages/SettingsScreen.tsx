import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { api, LearningProfile, User as ApiUser } from "../services/api";
import { useI18n, LANGUAGES, type Lang } from "../lib/i18n";
import { DataSharing } from "../components/DataSharing";
import { PublicProfileSettings } from "../components/PublicProfileSettings";
import type { Keys } from "../locales/en";
import { ROUTES } from "../lib/routes";
import { setThemePreference, useThemePreference, type ThemePreference } from "../lib/theme";
import { LinkedAccounts } from "../components/LinkedAccounts";
import type { FeedMode } from "./FeedScreen";

interface SettingsScreenProps {
  user: ApiUser | null;
  interests: string[];
  onToggleInterest: (interest: string) => void;
  feedMode: FeedMode;
  onFeedModeChange: (mode: FeedMode) => void;
  onUserUpdate: (user: ApiUser) => void;
  onLogout: () => void;
}

const INTERESTS = ["AI & ML", "Frontend", "Backend", "Systems", "Security", "DevOps", "Databases", "Cloud"];

const THEMES: Array<{ id: ThemePreference; label: Keys; icon: typeof Sun }> = [
  { id: "system", label: "set.theme.system", icon: Monitor },
  { id: "light", label: "set.theme.light", icon: Sun },
  { id: "dark", label: "set.theme.dark", icon: Moon },
];

/** A settings block: a title and a short description on the left, the controls on the right. */
function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid md:grid-cols-[240px_minmax(0,1fr)] gap-x-10 gap-y-4 py-8 border-b border-border last:border-b-0">
      <div>
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ id: T; label: string; icon?: typeof Sun }>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1 rounded-xl border border-border bg-secondary p-1">
      {options.map(({ id, label: text, icon: Icon }) => (
        <button
          key={id}
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${value === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
        >
          {Icon && <Icon size={15} />}
          {text}
        </button>
      ))}
    </div>
  );
}

export function SettingsScreen({ user, interests, onToggleInterest, feedMode, onFeedModeChange, onUserUpdate, onLogout }: SettingsScreenProps) {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [learning, setLearning] = useState<LearningProfile | null | undefined>(undefined);
  useEffect(() => {
    api.getLearningProfile().then(setLearning).catch(() => setLearning(null));
  }, []);
  const themePreference = useThemePreference();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const dirty = name.trim() !== (user?.name ?? "");

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return void toast.error(t("set.name"));
    setSaving(true);
    try {
      const res = await api.updateProfile(trimmed);
      if (res.success && res.user) {
        onUserUpdate(res.user);
        toast.success(t("set.nameSaved"));
      } else toast.error(res.error || t("path.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-16">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t("set.title")}</h1>

        <div className="mt-2">
          <Section title={t("set.account")} description={t("set.account.text")}>
            <div className="space-y-4 max-w-md">
              <label className="block">
                <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("set.name")}</span>
                <div className="flex gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && dirty && void saveName()}
                    maxLength={100}
                    className="flex-1 min-w-0 h-10 rounded-xl bg-secondary border border-border px-3 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                  <button onClick={saveName} disabled={!dirty || saving} className="px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40">
                    {saving ? t("common.saving") : t("common.save")}
                  </button>
                </div>
              </label>
              <div>
                <span className="block text-xs font-medium text-muted-foreground mb-1.5">{t("set.email")}</span>
                <div className="h-10 rounded-xl bg-secondary/50 border border-border px-3 flex items-center text-sm text-muted-foreground font-mono truncate">{user?.email}</div>
              </div>
            </div>
          </Section>

          <Section title={t("set.appearance")} description={t("set.appearance.text")}>
            <Segmented label={t("set.appearance")} value={themePreference} options={THEMES.map((o) => ({ ...o, label: t(o.label) }))} onChange={setThemePreference} />
          </Section>

          <Section title={t("set.language")} description={t("set.language.text")}>
            <Segmented<Lang> label={t("set.language")} value={lang} options={LANGUAGES.map((l) => ({ id: l.id, label: l.label }))} onChange={setLang} />
          </Section>

          <Section title={t("set.feed")} description={t("set.feed.text")}>
            <div className="space-y-6">
              <div>
                <span className="block text-xs font-medium text-muted-foreground mb-2">{t("set.feed.order")}</span>
                <Segmented
                  label={t("set.feed.order")}
                  value={feedMode}
                  options={[
                    { id: "foryou", label: t("feed.forYou") },
                    { id: "latest", label: t("feed.latest") },
                  ]}
                  onChange={onFeedModeChange}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {feedMode === "foryou" ? t("set.feed.orderForYou") : t("set.feed.orderLatest")}
                </p>
              </div>
              <div>
                <span className="block text-xs font-medium text-muted-foreground mb-2">{t("set.feed.topics")}</span>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((tag) => {
                    const active = interests.includes(tag);
                    return (
                      <button
                        key={tag}
                        aria-pressed={active}
                        onClick={() => onToggleInterest(tag)}
                        className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${active ? "bg-primary text-white" : "bg-secondary text-muted-foreground border border-border hover:text-foreground"}`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Section>

          <Section title={t("set.learning")} description={t("set.learning.text")}>
            {learning === undefined ? (
              <div className="h-24 rounded-xl bg-secondary animate-pulse max-w-md" />
            ) : learning ? (
              <div className="max-w-md space-y-4">
                <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                  <dt className="text-muted-foreground">{t("set.learning.goal")}</dt>
                  <dd className="text-foreground">{t(`goal.${learning.goal}` as Keys)}</dd>
                  <dt className="text-muted-foreground">{t("set.learning.level")}</dt>
                  <dd className="text-foreground">{t(`lvl.${learning.level}` as Keys)}</dd>
                  <dt className="text-muted-foreground">{t("set.learning.languages")}</dt>
                  <dd className="text-foreground">{learning.languages.join(", ") || "—"}</dd>
                  <dt className="text-muted-foreground">{t("set.learning.time")}</dt>
                  <dd className="text-foreground">{t("set.learning.perWeek", { n: learning.hoursPerWeek })}</dd>
                  <dt className="text-muted-foreground">{t("set.learning.style")}</dt>
                  <dd className="text-foreground">{t(`style.${learning.style}` as Keys)}</dd>
                </dl>
                <button onClick={() => navigate(`${ROUTES.onboarding}?edit=1`)} className="px-4 h-10 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary">
                  {t("path.edit")}
                </button>
              </div>
            ) : (
              <div className="max-w-md">
                <p className="text-sm text-muted-foreground mb-3">{t("set.learning.none")}</p>
                <button onClick={() => navigate(ROUTES.onboarding)} className="px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold">
                  {t("set.learning.build")}
                </button>
              </div>
            )}
          </Section>

          <Section title={t("data.title")} description={t("data.subtitle")}>
            <DataSharing />
          </Section>

          <Section title={t("set.public")} description={t("set.public.text")}>
            <PublicProfileSettings />
          </Section>

          <Section title={t("set.security")} description={t("set.security.text")}>
            <LinkedAccounts bare />
          </Section>

          <Section title={t("set.session")} description={t("set.session.text")}>
            <button onClick={() => setConfirmingLogout(true)} className="inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-border text-sm font-medium text-red-400 hover:bg-secondary transition-colors">
              <LogOut size={15} /> {t("set.signOut")}
            </button>
          </Section>
        </div>
      </div>

      {confirmingLogout && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-6" onClick={() => setConfirmingLogout(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-xs shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-foreground mb-1">{t("set.signOut.title")}</h3>
            <p className="text-sm text-muted-foreground mb-6">{t("set.signOut.text")}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmingLogout(false)} className="flex-1 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors">
                {t("common.cancel")}
              </button>
              <button onClick={onLogout} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
                {t("set.signOut")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
