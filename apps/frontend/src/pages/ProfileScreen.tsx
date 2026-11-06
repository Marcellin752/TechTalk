import { useState } from "react";
import { ArrowLeft, User, Info, LogOut, Bookmark, ChevronRight, Github, Globe, MapPin, Pencil, Sparkles } from "lucide-react";
import { User as ApiUser, LearningPath } from "../services/api";
import { useI18n } from "../lib/i18n";
import { EditProfileDialog } from "../components/EditProfileDialog";
import { api, ProfileSettings } from "../services/api";
import { useEffect } from "react";
import { LearningSummary } from "../components/LearningSummary";
import { ActivityHistory } from "../components/ActivityHistory";
import { DeveloperHeader, LanguageBar, LinkGithubPrompt, ProjectsGrid, useGithubProfile } from "../components/DeveloperProfile";

interface ProfileScreenProps {
  user: ApiUser | null;
  savedCount: number;
  readCount: number;
  readDates: string[];
  interests: string[];
  onToggleInterest: (interest: string) => void;
  onNavigateToSaved: () => void;
  onNavigateToAbout: () => void;
  onLogout: () => void;
  onBack: () => void;
  onUserUpdate?: (user: ApiUser) => void;
  learningPath?: LearningPath | null;
  learningLoaded?: boolean;
  onOpenPath?: () => void;
  onStartOnboarding?: () => void;
}

const SECTIONS: { id: Section; label: string; icon: typeof UserIcon }[] = [
  { id: "profil", label: "Mon profil", icon: UserIcon },
  { id: "favoris", label: "Mes favoris", icon: Bookmark },
  { id: "historique", label: "Historique", icon: History },
  { id: "abonnements", label: "Abonnements", icon: Sparkles },
  { id: "parametres", label: "Paramètres", icon: Settings },
];

export function ProfileScreen() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const { user, setUser, logout, saved, toggleSave, readIds, readDates, interestTags, interestSlugs, toggleInterest } = useAppStore();

  const section = (params.get("tab") as Section) || "profil";
  const [pool, setPool] = useState<ContentItem[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<TagRef[]>([]);

export function ProfileScreen({
  user,
  savedCount,
  readCount,
  readDates,
  interests,
  onToggleInterest,
  onNavigateToSaved,
  onNavigateToAbout,
  onLogout,
  onBack,
  onUserUpdate = () => undefined,
  learningPath = null,
  learningLoaded = true,
  onOpenPath = () => undefined,
  onStartOnboarding = () => undefined,
}: ProfileScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const topicGroups = useMemo(() => groupTagsByKind(catalog), [catalog]);

  const streak = computeStreak(readDates);
  const stats = [
    { label: "profile.stats.saved" as const, value: savedCount.toString() },
    { label: "profile.stats.read" as const, value: readCount.toString() },
    { label: "profile.stats.streak" as const, value: streak > 0 ? `${streak}d` : "—" },
  ];

  const history = pool.filter((i) => readIds.has(i.id));
  const videos = pool.filter((i) => i.type === "video");
  const readVideos = history.filter((i) => i.type === "video");

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Le nom ne peut pas être vide.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.updateProfile(trimmed);
      if (res.success && res.user) {
        setUser(res.user);
        toast.success("Profil mis à jour !");
        setEditingName(false);
      } else {
        toast.error(res.error || "Échec de la mise à jour.");
      }
    } finally {
      setSaving(false);
    }
  };

  const setSection = (s: Section) => {
    const next = new URLSearchParams(params);
    if (s === "profil") next.delete("tab");
    else next.set("tab", s);
    setParams(next);
  };

  const openItem = (item: ContentItem) => navigate(`/content/${item.id}`, { state: { item } });

  const initials = (user?.name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const { t } = useI18n();
  const { state: gh, failed: ghFailed, syncing, sync } = useGithubProfile();
  const profile = gh?.profile ?? null;
  const [details, setDetails] = useState<ProfileSettings | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    api.getProfileSettings().then((r) => setDetails(r.settings)).catch(() => undefined);
  }, []);
  // What the learner wrote wins over what GitHub or Google say.
  const avatar = details?.avatarUrl || user?.picture || profile?.avatarUrl || null;
  const bio = details?.bio || profile?.bio || null;
  const topLanguages = profile?.languages.slice(0, 3) ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 py-7 pb-12">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft size={18} />
          <span className="text-sm">Back to Feed</span>
        </button>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-8 items-start">
          {/* Main column: who you are as a developer */}
          <div className="min-w-0 space-y-8">
            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex items-start gap-4 sm:gap-5">
                {avatar ? (
                  <img src={avatar} alt={user?.name || "Profile"} className="w-20 h-20 rounded-2xl object-cover border border-border flex-shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-primary/15 border border-border flex items-center justify-center flex-shrink-0">
                    <User size={32} className="text-primary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight truncate">{user?.name || profile?.name || "Tech Enthusiast"}</h2>
                  {profile ? (
                    <a href={profile.htmlUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary font-mono mt-0.5">
                      <Github size={13} /> @{profile.login}
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground font-mono mt-0.5 truncate">{user?.email}</p>
                  )}
                  {bio && <p className="text-sm text-foreground/80 leading-relaxed mt-2">{bio}</p>}
                  {(details?.location || details?.website) && (
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground mt-2">
                      {details?.location && <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {details.location}</span>}
                      {details?.website && (
                        <a href={details.website} target="_blank" rel="noopener noreferrer nofollow me" className="inline-flex items-center gap-1.5 hover:text-primary truncate max-w-full">
                          <Globe size={13} /> {details.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </a>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setEditing(true)} className="mt-4 inline-flex items-center gap-2 px-4 h-9 rounded-xl border border-border text-[13px] font-medium text-foreground hover:bg-secondary">
                <Pencil size={14} /> {t("profile.edit")}
              </button>
              {profile && <DeveloperHeader profile={profile} syncing={syncing} onSync={sync} />}
            </section>

            <LearningSummary path={learningPath} loaded={learningLoaded} onOpen={onOpenPath} onStart={onStartOnboarding} />

            {gh === null && !ghFailed && <div className="h-40 rounded-2xl bg-secondary animate-pulse" />}
            {ghFailed && <p className="text-sm text-muted-foreground">Couldn't load your developer profile. Try again later.</p>}
            {gh && !gh.linked && <LinkGithubPrompt />}
            {gh?.linked && !profile && (
              <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
                {gh.error ? `GitHub import failed: ${gh.error}` : "Importing from GitHub…"}
                <button onClick={sync} disabled={syncing} className="ml-2 text-primary underline">
                  Retry
                </button>
              </div>
            )}

            {profile && (
              <>
                <section>
                  <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">{t("profile.languages")}</h3>
                  <LanguageBar languages={profile.languages} />
                </section>
                <section>
                  <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">{t("profile.projects")}</h3>
                  <ProjectsGrid repos={profile.topRepos} />
                </section>
              </>
            )}

            <ActivityHistory />
          </div>

          {/* Side column: your activity, your feed, your account */}
          <div className="min-w-0 space-y-8">
            <div className="grid grid-cols-3 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="bg-secondary border border-border rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">{s.value}</div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-1 uppercase tracking-wide">{t(s.label)}</div>
                </div>
              ))}
            </div>

            <section className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2.5 flex items-center gap-1.5">
                <Sparkles size={12} className="text-primary" /> {t("profile.shapes")}
              </h3>
              <ul className="text-[13px] text-foreground/80 space-y-1.5 leading-snug">
                <li>
                  <span className="text-muted-foreground">Topics: </span>
                  {interests.length ? interests.join(", ") : "none chosen yet"}
                </li>
                <li>
                  <span className="text-muted-foreground">Languages: </span>
                  {topLanguages.length ? topLanguages.map((l) => l.name).join(", ") : profile ? "none detected" : "link GitHub to add yours"}
                </li>
                <li>
                  <span className="text-muted-foreground">Activity: </span>
                  {savedCount} saved, {readCount} read
                </li>
              </ul>
            </section>

            {/* Interests */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em]">My Interests</h3>
                <button onClick={() => setIsEditing(!isEditing)} className="text-xs text-primary font-mono hover:underline">
                  {isEditing ? "✓ Done" : "+ Edit"}
                </button>
              </div>
              {isEditing ? (
                <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-secondary border border-border">
                  {allAvailableInterests.map((tag) => {
                    const active = interests.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => onToggleInterest(tag)}
                        className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                          active ? "bg-primary text-white border border-primary shadow-sm shadow-primary/20" : "bg-background text-muted-foreground border border-border hover:text-foreground"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {interests.map((tag) => (
                    <span key={tag} className="px-3 py-1.5 bg-secondary border border-border rounded-full text-xs text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                  {interests.length === 0 && <span className="text-xs text-muted-foreground font-mono">No interests added yet. Click edit to choose!</span>}
                </div>
              )}
            </div>

            <div>
              <div className="rounded-2xl border border-border overflow-hidden bg-card">
                {menuItems.map((item, idx) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className={`w-full text-left px-4 py-3.5 text-sm text-foreground hover:bg-secondary transition-colors flex items-center justify-between ${
                      idx < menuItems.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">{item.icon}</span>
                      {item.label}
                    </span>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                ))}
              </div>

              <button
                onClick={() => setConfirmingLogout(true)}
                className="w-full mt-3 px-4 py-3.5 rounded-2xl text-sm text-red-400 hover:bg-secondary border border-border transition-colors flex items-center gap-2"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {editing && (
          <EditProfileDialog
            user={user}
            settings={details}
            githubAvatar={profile?.avatarUrl ?? null}
            githubBio={profile?.bio ?? null}
            onClose={() => setEditing(false)}
            onSaved={(settings, nextUser) => {
              setDetails(settings);
              if (nextUser) onUserUpdate(nextUser);
            }}
          />
        )}

          {/* ---------------- Abonnements (intérêts) ---------------- */}
          {section === "abonnements" && (
            <section>
              <h2 className="text-sm font-bold mb-1">Vos centres d'intérêt</h2>
              <p className="text-[13px] text-muted-foreground mb-4">
                {interestTags.length > 0
                  ? `${interestTags.length} sujet${interestTags.length > 1 ? "s" : "" } suivi${interestTags.length > 1 ? "s" : ""}. Ils personnalisent l'onglet « Abonnements » du flux et le classement « Pour toi ».`
                  : "Aucun sujet suivi. Choisissez-en quelques-uns pour personnaliser votre flux."}
              </p>
              <div className="tt-card space-y-5 p-5">
                {catalog.length === 0 && (
                  <p className="text-[13px] text-muted-foreground">Les sujets sont momentanément indisponibles.</p>
                )}
                {topicGroups.map((group) => (
                  <div key={group.kind}>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.tags.map((tag) => {
                        const active = interestSlugs.includes(tag.slug);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => toggleInterest(tag)}
                            className={`tt-chip transition-all ${
                              active ? "text-primary ring-1 ring-primary/50 bg-primary/10" : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---------------- Paramètres ---------------- */}
          {section === "parametres" && (
            <section className="space-y-4 max-w-md">
              <h2 className="text-sm font-bold">Paramètres</h2>
              <div className="tt-card divide-y divide-border/60">
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-[13px] font-semibold">Apparence</p>
                    <p className="text-[11px] text-muted-foreground">Thème clair ou sombre</p>
                  </div>
                  <button onClick={toggleTheme} className="tt-btn tt-btn-ghost gap-2 px-4 py-2 text-[12px]">
                    {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                    {theme === "dark" ? "Clair" : "Sombre"}
                  </button>
                </div>
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-[13px] font-semibold">Rôle</p>
                    <p className="text-[11px] text-muted-foreground">{user?.role === "admin" ? "Administrateur" : "Membre"}</p>
                  </div>
                  <span className="tt-chip">{user?.role || "user"}</span>
                </div>
                <Link to="/about" className="flex items-center justify-between px-5 py-4 hover:bg-surface-2 transition-colors">
                  <span className="flex items-center gap-2.5 text-[13px] font-semibold">
                    <Info size={14} className="text-muted-foreground" /> À propos de TechTalk
                  </span>
                  <span className="text-muted-foreground">→</span>
                </Link>
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-2 transition-colors text-left"
                >
                  <span className="flex items-center gap-2.5 text-[13px] font-semibold text-destructive">
                    <LogOut size={14} /> Se déconnecter
                  </span>
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
