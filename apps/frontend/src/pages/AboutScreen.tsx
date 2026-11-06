import { useI18n } from "../lib/i18n";
import { ArrowLeft, Rss, Bookmark, Search, User } from "lucide-react";

interface AboutScreenProps {
  onBack: () => void;
}

const SOURCES = ["Dev.to", "TechCrunch", "YouTube"];

const FEATURES = [
  { icon: <Rss size={16} />, title: "about.f1", desc: "about.f1d" },
  { icon: <Bookmark size={16} />, title: "about.f2", desc: "about.f2d" },
  { icon: <Search size={16} />, title: "about.f3", desc: "about.f3d" },
  { icon: <User size={16} />, title: "about.f4", desc: "about.f4d" },
] as const;

export function AboutScreen({ onBack }: AboutScreenProps) {
  const { t } = useI18n();
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">{t("about.back")}</span>
        </button>

        {/* App info */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
            <Rss size={24} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-foreground">TechTalk</h2>
        </div>

        {/* About */}
        <div className="rounded-2xl border border-border overflow-hidden bg-card p-5">
          <p className="text-sm text-foreground/85 leading-relaxed mb-4">{t("about.intro")}</p>

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
                  <div className="text-sm font-semibold text-foreground">{t(f.title)}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{t(f.desc)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
