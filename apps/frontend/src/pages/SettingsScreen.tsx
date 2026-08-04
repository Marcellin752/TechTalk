import { Rss, Bookmark, Search, User } from "lucide-react";
import { User as ApiUser } from "../services/api";

interface SettingsScreenProps {
  user: ApiUser | null;
}

const SOURCES = ["Dev.to", "TechCrunch", "Reddit", "YouTube"];

const FEATURES = [
  { icon: <Rss size={16} />, title: "Curated feed", desc: "Fresh tech articles & videos from across the web." },
  { icon: <Bookmark size={16} />, title: "Save for later", desc: "Bookmark posts and revisit them anytime." },
  { icon: <Search size={16} />, title: "Full-text search", desc: "Find exactly what you're looking for instantly." },
  { icon: <User size={16} />, title: "Your profile", desc: "Track reading streaks and personalize interests." },
];

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
            className="w-full text-left px-4 py-3.5 text-sm text-foreground hover:bg-secondary transition-colors flex items-center justify-between"
          >
            <span className="font-semibold">{user?.name || "Tech Enthusiast"}</span>
            <span className="text-muted-foreground text-xs font-mono">{user?.email || "guest"}</span>
          </button>
        </div>

        {/* About */}
        <section className="mb-8">
          <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">
            About TechTalk
          </h3>
          <div className="rounded-2xl border border-border overflow-hidden bg-card p-5">
            <p className="text-sm text-foreground/85 leading-relaxed mb-4">
              TechTalk is a <span className="font-semibold text-foreground">TikTok-style tech feed</span> — discover,
              scroll and learn. Instead of a noisy timeline, it curates high-quality technical articles and videos
              from across the internet into one clean, mobile-first stream.
            </p>

            <div className="flex flex-wrap gap-2 mb-5">
              {SOURCES.map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 rounded-full bg-secondary border border-border text-xs font-mono text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>

            <div className="space-y-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary">{f.icon}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{f.title}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
