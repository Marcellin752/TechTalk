import { useState } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";
import { api, User as ApiUser } from "../services/api";

interface SettingsScreenProps {
  user: ApiUser | null;
  interests: string[];
  onToggleInterest: (interest: string) => void;
  onUserUpdate: (user: ApiUser) => void;
  onBack: () => void;
  onNavigateToAbout: () => void;
}

const allAvailableInterests = ["AI & ML", "Frontend", "Systems", "Security", "DevOps", "Backend", "Databases", "Cloud"];

export function SettingsScreen({
  user,
  interests,
  onToggleInterest,
  onUserUpdate,
  onBack,
  onNavigateToAbout,
}: SettingsScreenProps) {
  const [name, setName] = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty.");
      return;
    }
    setSavingName(true);
    try {
      const res = await api.updateProfile(trimmed);
      if (res.success && res.user) {
        onUserUpdate(res.user);
        toast.success("Profile updated!");
      } else {
        toast.error(res.error || "Failed to update profile.");
      }
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-10 space-y-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back to Feed</span>
        </button>

        {/* Edit profile */}
        <section>
          <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">
            Edit Profile
          </h3>
          <div className="rounded-2xl border border-border overflow-hidden bg-card p-4">
            <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="flex-1 bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {savingName ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section>
          <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">
            Preferences
          </h3>
          <div className="rounded-2xl border border-border overflow-hidden bg-card p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Select the topics you're interested in.
            </p>
            <div className="flex flex-wrap gap-2">
              {allAvailableInterests.map((tag) => {
                const active = interests.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => onToggleInterest(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                      active
                        ? "bg-primary text-white border border-primary shadow-sm shadow-primary/20"
                        : "bg-secondary text-muted-foreground border border-border hover:text-foreground"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* About */}
        <section>
          <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">
            About
          </h3>
          <div className="rounded-2xl border border-border overflow-hidden bg-card">
            <button
              onClick={onNavigateToAbout}
              className="w-full text-left px-4 py-3.5 text-sm text-foreground hover:bg-secondary transition-colors flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Info size={14} className="text-muted-foreground" />
                About TechTalk
              </span>
              <ArrowLeft size={14} className="text-muted-foreground rotate-180" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
