import { Info, Rss } from "lucide-react";
import { toast } from "sonner";
import { User as ApiUser } from "../services/api";

interface SettingsScreenProps {
  user: ApiUser | null;
}

export function SettingsScreen({ user }: SettingsScreenProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-8 pb-10">
        {/* App info */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
            <Rss size={24} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-foreground">TechTalk</h2>
          <p className="text-sm text-muted-foreground font-mono mt-1">v1.0.0</p>
        </div>

        {/* Account summary */}
        <div className="rounded-2xl border border-border overflow-hidden bg-card mb-8">
          <button
            onClick={() => toast.info("You are signed in as " + (user?.email || "guest"))}
            className="w-full text-left px-4 py-3.5 text-sm text-foreground hover:bg-secondary transition-colors flex items-center justify-between"
          >
            <span>{user?.name || "Tech Enthusiast"}</span>
            <span className="text-muted-foreground text-xs font-mono">{user?.email || "guest"}</span>
          </button>
        </div>

        {/* About */}
        <div className="rounded-2xl border border-border overflow-hidden bg-card">
          <button
            onClick={() =>
              toast.info("TechTalk — TikTok for tech: discover, scroll, learn. Aggregates articles & videos from Dev.to, TechCrunch, Reddit and YouTube.")
            }
            className="w-full text-left px-4 py-3.5 text-sm text-foreground hover:bg-secondary transition-colors flex items-center justify-between"
          >
            <span>About TechTalk</span>
            <Info size={14} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
