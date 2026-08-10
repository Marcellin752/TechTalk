import { useState } from "react";
import { ArrowLeft, User, Info, LogOut, Bookmark, ChevronRight } from "lucide-react";
import { User as ApiUser } from "../services/api";

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

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back to Feed</span>
        </button>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-8">
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name || "Profile"}
              className="w-20 h-20 rounded-full object-cover border-2 border-primary/30 mb-4 shadow-lg shadow-primary/10"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center mb-4 shadow-lg shadow-primary/10">
              <User size={32} className="text-primary" />
            </div>
          )}
          <h2 className="text-xl font-bold text-foreground">{user?.name || "Tech Enthusiast"}</h2>
          <p className="text-sm text-muted-foreground font-mono mt-1">{user?.email || "developer@teachtalk.com"}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-secondary border border-border rounded-2xl p-4 text-center"
            >
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              <div className="text-[11px] text-muted-foreground font-mono mt-1 uppercase tracking-wide">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Interests */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em]">
              My Interests
            </h3>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-primary font-mono hover:underline"
            >
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
                      active
                        ? "bg-primary text-white border border-primary shadow-sm shadow-primary/20"
                        : "bg-background text-muted-foreground border border-border hover:text-foreground"
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
                <span
                  key={tag}
                  className="px-3 py-1.5 bg-secondary border border-border rounded-full text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
              {interests.length === 0 && (
                <span className="text-xs text-muted-foreground font-mono">No interests added yet. Click edit to choose!</span>
              )}
            </div>
          )}
        </div>

        {/* Menu */}
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
