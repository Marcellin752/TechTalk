import { useI18n } from "../lib/i18n";
import { ArrowLeft, Rss, Bookmark, Search, User } from "lucide-react";
import { BrandMark, BrandWord } from "../components/Brand";

interface AboutScreenProps {
  onBack: () => void;
}

const SOURCES = ["Dev.to", "TechCrunch", "YouTube", "Reddit"];

const FEATURES = [
  { icon: <Rss size={16} />, title: "about.f1", desc: "about.f1d" },
  { icon: <Bookmark size={16} />, title: "about.f2", desc: "about.f2d" },
  { icon: <Search size={16} />, title: "about.f3", desc: "about.f3d" },
  { icon: <User size={16} />, title: "about.f4", desc: "about.f4d" },
] as const;

export function AboutScreen({ onBack }: AboutScreenProps) {
  const { t } = useI18n();
  return (
    <div className="tt-fade-up flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 py-8 pb-10">
        <button
          onClick={onBack}
          className="-ml-2 mb-6 flex items-center gap-2 rounded-full px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">{t("about.back")}</span>
        </button>

        {/* App info */}
        <div className="relative mb-10 flex flex-col items-center overflow-hidden py-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-14 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full opacity-60 blur-3xl"
            style={{ background: "var(--surface-2)" }}
          />
          <BrandMark size={64} radius="16px" glyph={26} />
          <div className="mt-4">
            <BrandWord size="text-xl" />
          </div>
        </div>

        {/* About */}
        <div className="rounded-2xl border border-border overflow-hidden bg-card p-5">
          <p className="text-sm text-foreground/85 leading-relaxed mb-4">{t("about.intro")}</p>

          <div className="mb-6 flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <span key={s} className="tt-chip text-muted-foreground">
                {s}
              </span>
            ))}
          </div>

          <div className="tt-divider-brand mb-6" />

          <div className="tt-stagger space-y-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-2 ring-1 ring-border">
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
