import { useEffect, useState, type ComponentType } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { BookOpen, Bookmark, Brain, Briefcase, CalendarDays, Code2, Compass, GraduationCap, ChevronDown, Home, Info, Menu, Network, CalendarCheck, TrendingUp, Layers, FlaskConical, Terminal, MessagesSquare, Route, Settings, ShieldCheck, User, Users } from "lucide-react";
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

const HOME: Item = { to: ROUTES.home, label: "nav.home", icon: Home, end: true };
const EXPLORE: Item = { to: ROUTES.explore, label: "nav.explore", icon: Compass };
const KAIROS: Item = { to: ROUTES.kairos, label: "nav.kairos", icon: KairosIcon, badge: "AI" };

/** The app's dimensions: what you study, how you progress, what you build, who you do it with. */
interface Group { id: string; label: Keys; icon: ComponentType<any>; items: Item[] }
const GROUPS: Group[] = [
  { id: "study", label: "nav.group.study", icon: BookOpen, items: [
    { to: ROUTES.learn, label: "nav.learn", icon: BookOpen },
    { to: ROUTES.path, label: "nav.path", icon: Route },
    { to: ROUTES.practice, label: "nav.practice", icon: Code2 },
    { to: ROUTES.playground, label: "nav.playground", icon: Terminal },
  ] },
  { id: "progress", label: "nav.group.progress", icon: TrendingUp, items: [
    { to: ROUTES.today, label: "nav.today", icon: CalendarCheck },
    { to: ROUTES.skills, label: "nav.skills", icon: Network },
    { to: ROUTES.memory, label: "nav.memory", icon: Layers },
    { to: ROUTES.review, label: "nav.review", icon: Brain },
    { to: ROUTES.calendar, label: "nav.calendar", icon: CalendarDays },
    { to: ROUTES.growth, label: "nav.growth", icon: TrendingUp },
  ] },
  { id: "build", label: "nav.group.build", icon: FlaskConical, items: [
    { to: ROUTES.lab, label: "nav.lab", icon: FlaskConical },
    { to: ROUTES.opportunities, label: "nav.opportunities", icon: Briefcase },
  ] },
  { id: "together", label: "nav.group.together", icon: Users, items: [
    { to: ROUTES.community, label: "nav.community", icon: MessagesSquare },
    { to: ROUTES.campus, label: "nav.campus", icon: GraduationCap },
    { to: ROUTES.people, label: "nav.people", icon: Users },
  ] },
];
const YOU: Item[] = [
  { to: ROUTES.saved, label: "nav.saved", icon: Bookmark },
  { to: ROUTES.profile, label: "nav.profile", icon: User },
  { to: ROUTES.settings, label: "nav.settings", icon: Settings },
  { to: ROUTES.about, label: "nav.about", icon: Info },
];
const ADMIN: Item = { to: ROUTES.admin, label: "nav.admin", icon: ShieldCheck };
// On phones four shortcuts and a "More" sheet that holds everything. Kairos has its floating button.
const BOTTOM: Item[] = [HOME, GROUPS[0]!.items[1]!, GROUPS[1]!.items[0]!, GROUPS[1]!.items[1]!];

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
          ? `flex shrink-0 flex-col items-center gap-1 rounded-lg py-3 text-[10px] transition-colors ${isActive ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`
          : `flex shrink-0 items-center gap-4 rounded-lg px-3 h-10 text-[14px] transition-colors ${isActive ? "bg-secondary text-foreground font-semibold" : "text-foreground/80 hover:bg-secondary"}`
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

const OPEN_KEY = "teachtalk_menu_groups";
const readOpen = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}"); } catch { return {}; }
};

function GroupHeader({ g, open, active, onToggle }: { g: Group; open: boolean; active: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  return (
    <button onClick={onToggle} aria-expanded={open} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 h-8 mt-2 text-[11px] font-mono uppercase tracking-[0.15em] hover:text-foreground ${active && !open ? "text-primary" : "text-muted-foreground"}`}>
      {t(g.label)}
      <ChevronDown size={13} className={`ml-auto transition-transform ${open ? "" : "-rotate-90"}`} />
    </button>
  );
}

export function SideMenu({ collapsed, isAdmin = false }: { collapsed: boolean; isAdmin?: boolean }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [open, setOpen] = useState<Record<string, boolean>>(readOpen);
  const isIn = (g: Group) => g.items.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));
  // The group you are in is always open; the others stay as you left them (open by default).
  const isOpen = (g: Group) => isIn(g) || open[g.id] !== false;
  const toggle = (g: Group) => {
    const next = { ...open, [g.id]: !isOpen(g) };
    setOpen(next);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* remembered only when storage works */ }
  };
  return (
    <nav aria-label={t("nav.main")} className={`hidden lg:flex flex-col flex-shrink-0 border-r border-border bg-background overflow-y-auto ${collapsed ? "w-[72px] px-1 py-3 gap-1" : "w-56 p-3 gap-0.5"}`}>
      <Row item={HOME} mini={collapsed} />
      <Row item={EXPLORE} mini={collapsed} />
      <Row item={KAIROS} mini={collapsed} />
      {GROUPS.map((g) => (
        <div key={g.id} role="group" aria-label={t(g.label)} className="flex shrink-0 flex-col gap-0.5">
          {collapsed ? <div className="my-2 mx-2 border-t border-border" /> : <GroupHeader g={g} open={isOpen(g)} active={isIn(g)} onToggle={() => toggle(g)} />}
          {(collapsed || isOpen(g)) && g.items.map((i) => <Row key={i.to} item={i} mini={collapsed} />)}
        </div>
      ))}
      <div className={`${collapsed ? "my-2" : "my-3 mx-3"} border-t border-border`} />
      {!collapsed && <span className="px-3 pb-1 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{t("nav.you")}</span>}
      {YOU.map((i) => (
        <Row key={i.to} item={i} mini={collapsed} />
      ))}
      {isAdmin && <Row item={ADMIN} mini={collapsed} />}
    </nav>
  );
}

/** The phone's way to everything: a sheet that rises over the bar, with the same dimensions. */
function MoreSheet({ onClose, isAdmin }: { onClose: () => void; isAdmin: boolean }) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const link = (i: Item) => (
    <NavLink key={i.to} to={i.to} end={i.end} onClick={onClose} className={({ isActive }) => `flex flex-col items-center gap-1 rounded-xl py-3 text-[11px] text-center ${isActive ? "bg-secondary text-foreground font-semibold" : "text-muted-foreground"}`}>
      <i.icon size={22} />
      {t(i.label)}
    </NavLink>
  );
  return (
    <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t("nav.more")}>
      <button aria-label={t("common.cancel")} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-background border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-4 gap-1 mb-3">{[EXPLORE, KAIROS].map(link)}</div>
        {GROUPS.map((g) => (
          <section key={g.id} className="mb-3">
            <h2 className="px-2 pb-1 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{t(g.label)}</h2>
            <div className="grid grid-cols-4 gap-1">{g.items.map(link)}</div>
          </section>
        ))}
        <section>
          <h2 className="px-2 pb-1 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{t("nav.you")}</h2>
          <div className="grid grid-cols-4 gap-1">{[...YOU, ...(isAdmin ? [ADMIN] : [])].map(link)}</div>
        </section>
      </div>
    </div>
  );
}

export function BottomBar({ isAdmin = false }: { isAdmin?: boolean }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [pathname]);
  const shown = new Set([...BOTTOM.map((i) => i.to)]);
  const moreActive = !shown.has(pathname) && !BOTTOM.some((i) => i.to !== "/" && pathname.startsWith(`${i.to}/`)) && pathname !== "/";
  return (
    <>
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
        <button onClick={() => setMore(true)} aria-haspopup="dialog" className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${moreActive ? "text-primary font-semibold" : "text-muted-foreground"}`}>
          <Menu size={20} />
          {t("nav.more")}
        </button>
      </nav>
      {more && <MoreSheet onClose={() => setMore(false)} isAdmin={isAdmin} />}
    </>
  );
}
