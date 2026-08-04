import { useState } from "react";
import { User, ChevronRight, Bell, Info, LogOut } from "lucide-react";
import { toast } from "sonner";
import { User as ApiUser } from "../services/api";

interface ProfileScreenProps {
  user: ApiUser | null;
  savedCount: number;
  readCount: number;
  interests: string[];
  onToggleInterest: (interest: string) => void;
  onLogout: () => void;
}

export function ProfileScreen({
  user,
  savedCount,
  readCount,
  interests,
  onToggleInterest,
  onLogout,
}: ProfileScreenProps) {
  const [isEditing, setIsEditing] = useState(false);

  const allAvailableInterests = ["AI & ML", "Frontend", "Systems", "Security", "DevOps", "Backend", "Databases", "Cloud"];

  const stats = [
    { label: "Saved", value: savedCount.toString() },
    { label: "Read", value: readCount.toString() },
    { label: "Streak", value: readCount > 0 ? "3d" : "0d" },
  ];

  const menuItems = [
    { label: "Settings", icon: <ChevronRight size={14} /> },
    { label: "Notifications", icon: <Bell size={14} /> },
    { label: "About TechTalk", icon: <Info size={14} /> },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-8 pb-10">
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
              onClick={() => toast.info(`${item.label} feature is coming in the next update!`)}
              className={`w-full text-left px-4 py-3.5 text-sm text-foreground hover:bg-secondary transition-colors flex items-center justify-between ${
                idx < menuItems.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span>{item.label}</span>
              <span className="text-muted-foreground">{item.icon}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onLogout}
          className="w-full mt-3 text-left px-4 py-3.5 rounded-2xl text-sm text-red-400 hover:bg-secondary border border-border transition-colors flex items-center gap-2"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
