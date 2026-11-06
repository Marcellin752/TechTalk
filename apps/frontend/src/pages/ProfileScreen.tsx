import { useState } from "react";
import { ArrowLeft, User, Info, LogOut, Bookmark, ChevronRight, Github, Sparkles } from "lucide-react";
import { User as ApiUser } from "../services/api";
import { LinkedAccounts } from "../components/LinkedAccounts";
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
}

function computeStreak(readDates: string[]): number {
  const days = new Set(readDates);
  const dayMs = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let cursor = new Date(today);

  // If nothing read today, streak can still count from yesterday.
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setTime(cursor.getTime() - dayMs);
  }

  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setTime(cursor.getTime() - dayMs);
  }
  return streak;
}

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
}: ProfileScreenProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const allAvailableInterests = ["AI & ML", "Frontend", "Systems", "Security", "DevOps", "Backend", "Databases", "Cloud"];

  const streak = computeStreak(readDates);
  const stats = [
    { label: "Saved", value: savedCount.toString() },
    { label: "Read", value: readCount.toString() },
    { label: "Streak", value: streak > 0 ? `${streak}d` : "—" },
  ];

  const menuItems = [
    { label: "My Saved Items", icon: <Bookmark size={14} />, action: onNavigateToSaved },
    { label: "About TechTalk", icon: <Info size={14} />, action: onNavigateToAbout },
  ];

  const { state: gh, failed: ghFailed, syncing, sync } = useGithubProfile();
  const profile = gh?.profile ?? null;
  const avatar = user?.picture || profile?.avatarUrl || null;
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
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight truncate">{profile?.name || user?.name || "Tech Enthusiast"}</h2>
                  {profile ? (
                    <a href={profile.htmlUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary font-mono mt-0.5">
                      <Github size={13} /> @{profile.login}
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground font-mono mt-0.5 truncate">{user?.email}</p>
                  )}
                  {profile?.bio && <p className="text-sm text-foreground/80 leading-relaxed mt-2">{profile.bio}</p>}
                </div>
              </div>
              {profile && <DeveloperHeader profile={profile} syncing={syncing} onSync={sync} />}
            </section>

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
                  <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">Languages</h3>
                  <LanguageBar languages={profile.languages} />
                </section>
                <section>
                  <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">Projects</h3>
                  <ProjectsGrid repos={profile.topRepos} />
                </section>
              </>
            )}
          </div>

          {/* Side column: your activity, your feed, your account */}
          <div className="min-w-0 space-y-8">
            <div className="grid grid-cols-3 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="bg-secondary border border-border rounded-2xl p-4 text-center">
                  <div className="text-2xl font-bold text-foreground">{s.value}</div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-1 uppercase tracking-wide">{s.label}</div>
                </div>
              ))}
            </div>

            <section className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-2.5 flex items-center gap-1.5">
                <Sparkles size={12} className="text-primary" /> What shapes your feed
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

            <LinkedAccounts />

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

        {/* Sign out confirmation dialog */}
        {confirmingLogout && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-6"
            onClick={() => setConfirmingLogout(false)}
          >
            <div
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-xs shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                <LogOut size={20} className="text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">Sign out?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                You'll need to sign in again to access your feed and saved items.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmingLogout(false)}
                  className="flex-1 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onLogout}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
