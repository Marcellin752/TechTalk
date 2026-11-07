import { useEffect, useRef, useState } from "react";
import { GraduationCap, MoreHorizontal, Plus, Sparkles, Star, User } from "lucide-react";
import type { PathKind, PathSummary } from "../services/api";
import { useI18n } from "../lib/i18n";

const ICON: Record<PathKind, typeof User> = { school: GraduationCap, personal: User, custom: Sparkles };

interface Props {
  paths: PathSummary[];
  selectedId: string | null;
  max: number;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: () => void;
  onMakeMain: () => void;
  onRebuild: () => void;
  onDelete: () => void;
}

/** One tab per path (school, personal, the ones you made), the main one starred, and a menu for the selected one. */
export function PathSwitcher({ paths, selectedId, max, onSelect, onNew, onRename, onMakeMain, onRebuild, onDelete }: Props) {
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = paths.find((p) => p.id === selectedId);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const item = "w-full text-left px-3 h-9 rounded-lg text-[13px] text-foreground hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="flex items-stretch gap-2">
      <div role="tablist" aria-label={t("paths.title")} className="flex-1 min-w-0 flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {paths.map((p) => {
          const Icon = ICON[p.kind];
          const on = p.id === selectedId;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={on}
              onClick={() => onSelect(p.id)}
              title={p.title}
              className={`flex-shrink-0 max-w-[260px] flex items-center gap-2.5 pl-3 pr-3.5 h-12 rounded-xl border text-left transition-colors ${on ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-secondary"}`}
            >
              <Icon size={16} className={on ? "text-primary" : "text-muted-foreground"} />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground leading-tight">
                  <span className="truncate">{p.title}</span>
                  {p.active && <Star size={11} className="text-primary fill-primary flex-shrink-0" aria-label={t("paths.main")} />}
                </span>
                <span className="block text-[11px] text-muted-foreground leading-tight">{t(`paths.kind.${p.kind}`)} · {p.progress.percent}%</span>
              </span>
            </button>
          );
        })}
        {paths.length < max && (
          <button onClick={onNew} className="flex-shrink-0 flex items-center gap-2 px-3.5 h-12 rounded-xl border border-dashed border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-primary">
            <Plus size={16} /> {t("paths.new")}
          </button>
        )}
      </div>

      {selected && (
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button onClick={() => setMenu((v) => !v)} aria-haspopup="menu" aria-expanded={menu} aria-label={t("paths.menu")} className="w-12 h-12 rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary">
            <MoreHorizontal size={18} />
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 top-14 z-30 w-56 rounded-xl border border-border bg-card shadow-xl p-1.5">
              <button role="menuitem" className={item} onClick={() => (setMenu(false), onRename())}>{t("paths.rename")}</button>
              <button role="menuitem" className={item} disabled={selected.active} onClick={() => (setMenu(false), onMakeMain())}>{t("paths.makeMain")}</button>
              <button role="menuitem" className={item} onClick={() => (setMenu(false), onRebuild())}>{t("path.rebuild")}</button>
              <div className="my-1 border-t border-border" />
              <button role="menuitem" className={`${item} text-destructive`} onClick={() => (setMenu(false), onDelete())}>{t("paths.delete")}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
