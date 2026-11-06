import { Link } from "react-router-dom";
import { Rss, Languages } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useI18n, LANGUAGES } from "../lib/i18n";
import { api } from "../services/api";

/** A language switch that fits in a header: one tap flips between the two languages. */
export function LangSwitch() {
  const { lang, setLang } = useI18n();
  const next = LANGUAGES.find((l) => l.id !== lang)!;
  return (
    <button
      onClick={() => setLang(next.id)}
      title={next.label}
      aria-label={`${next.label}`}
      className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
    >
      <Languages size={16} /> {next.id.toUpperCase()}
    </button>
  );
}

/** Frame for pages anyone can open: a light header with sign-in, no side menu. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const signedIn = !!api.getToken();
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-[57px] flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 mr-auto" aria-label="TechTalk">
            <span className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/30">
              <Rss size={13} className="text-white" />
            </span>
            <span className="text-[18px] font-bold tracking-tight text-foreground">TechTalk</span>
          </Link>
          <Link to="/people" className="hidden sm:inline-flex px-3 h-9 items-center rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary">
            {t("nav.people")}
          </Link>
          <LangSwitch />
          <ThemeToggle />
          <Link to={signedIn ? "/" : "/login"} className="inline-flex items-center px-4 h-9 rounded-xl bg-primary text-white text-sm font-semibold shadow-md shadow-primary/25">
            {signedIn ? t("nav.home") : t("common.signIn")}
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
