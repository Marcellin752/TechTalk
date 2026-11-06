import type { ComponentType } from "react";
import { NavLink } from "react-router-dom";
import { BookOpen, Bookmark, Code2, Home, Info, Route, Settings, User, Users } from "lucide-react";
import { KairosIcon } from "./KairosArt";
import { ROUTES } from "../lib/routes";
import { useI18n } from "../lib/i18n";
import type { Keys } from "../locales/en";

/* The app's main navigation: a side menu on wide screens (collapsible to an
   icon rail) and a bottom bar on phones. */

interface Item {
  to: string;
  label: Keys;
  icon: ComponentType<any>;
  end?: boolean;
  badge?: string;
}

const MAIN: Item[] = [
  { to: ROUTES.home, label: "nav.home", icon: Home, end: true },
  { to: ROUTES.learn, label: "nav.learn", icon: BookOpen },
  { to: ROUTES.path, label: "nav.path", icon: Route },
  { to: ROUTES.practice, label: "nav.practice", icon: Code2 },
  { to: ROUTES.kairos, label: "nav.kairos", icon: KairosIcon, badge: "AI" },
  { to: ROUTES.people, label: "nav.people", icon: Users },
];
const YOU: Item[] = [
  { to: ROUTES.saved, label: "nav.saved", icon: Bookmark },
  { to: ROUTES.profile, label: "nav.profile", icon: User },
  { to: ROUTES.settings, label: "nav.settings", icon: Settings },
  { to: ROUTES.about, label: "nav.about", icon: Info },
];
const BOTTOM: Item[] = [MAIN[0]!, MAIN[1]!, MAIN[2]!, MAIN[3]!, YOU[1]!]; // Kairos has its floating button on phones

function Row({ item, mini }: { item: Item; mini: boolean }) {
  const { t } = useI18n();
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={t(item.label)}
      className={({ isActive }) =>
        mini
          ? `flex flex-col items-center gap-1 rounded-lg py-3 text-[10px] transition-colors ${isActive ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`
          : `flex items-center gap-4 rounded-lg px-3 h-10 text-[14px] transition-colors ${isActive ? "bg-secondary text-foreground font-semibold" : "text-foreground/80 hover:bg-secondary"}`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} className={isActive ? "text-primary" : ""} />
          {t(item.label)}
          {item.badge && !mini && <span className="ml-auto px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-bold tracking-wide">{item.badge}</span>}
        </>
      )}
    </NavLink>
  );
}

export function SideMenu({ collapsed }: { collapsed: boolean }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("nav.main")} className={`hidden lg:flex flex-col flex-shrink-0 border-r border-border bg-background overflow-y-auto ${collapsed ? "w-[72px] px-1 py-3 gap-1" : "w-56 p-3 gap-0.5"}`}>
      {MAIN.map((i) => (
        <Row key={i.to} item={i} mini={collapsed} />
      ))}
      <div className={`${collapsed ? "my-2" : "my-3 mx-3"} border-t border-border`} />
      {!collapsed && <span className="px-3 pb-1 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{t("nav.you")}</span>}
      {YOU.map((i) => (
        <Row key={i.to} item={i} mini={collapsed} />
      ))}
    </nav>
  );
}

export function BottomBar() {
  const { t } = useI18n();
  return (
    <nav aria-label={t("nav.main")} className="lg:hidden flex-shrink-0 grid grid-cols-5 border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      {BOTTOM.map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          end={i.end}
          className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[10px] ${isActive ? "text-primary font-semibold" : "text-muted-foreground"}`}
        >
          <i.icon size={20} />
          {t(i.label)}
        </NavLink>
      ))}
    </nav>
  );
}
