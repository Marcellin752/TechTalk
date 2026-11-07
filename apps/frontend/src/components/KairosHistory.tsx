import { useEffect, useRef, useState } from "react";
import { Check, MessageSquarePlus, MoreHorizontal, Pencil, Search, Trash2, X } from "lucide-react";
import type { KairosConversation } from "../services/api";
import { groupHistory, type HistoryGroup } from "../lib/kairosHistory";
import { useI18n } from "../lib/i18n";

interface Props {
  list: KairosConversation[] | null;
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => Promise<boolean> | boolean;
  onDelete: (id: string) => void;
  onClearAll?: () => void;
  /** Smaller, for a popover. */
  compact?: boolean;
}

const GROUP_KEY: Record<HistoryGroup, "kairos.group.today" | "kairos.group.yesterday" | "kairos.group.week" | "kairos.group.older"> = {
  today: "kairos.group.today", yesterday: "kairos.group.yesterday", week: "kairos.group.week", older: "kairos.group.older",
};

/** The conversations: a search box, groups by day, and a menu on each (rename, delete). */
export function KairosHistory({ list, activeId, onOpen, onNew, onRename, onDelete, onClearAll, compact = false }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuFor) return;
    const close = (e: MouseEvent) => !(e.target as HTMLElement).closest("[data-row-menu]") && setMenuFor(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenuFor(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menuFor]);

  const groups = groupHistory(list ?? [], query);
  const commit = async (id: string) => {
    const title = draft.trim();
    setEditing(null);
    if (title) await onRename(id, title);
  };

  return (
    <div ref={wrap} className="flex flex-col h-full min-h-0">
      <div className={`${compact ? "p-2.5" : "p-3"} space-y-2.5`}>
        <button onClick={onNew} className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-white text-sm font-semibold shadow-md shadow-primary/25 hover:bg-primary/90 transition-colors">
          <MessageSquarePlus size={16} /> {t("kairos.new")}
        </button>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("kairos.searchChats")}
            aria-label={t("kairos.searchChats")}
            className="w-full h-9 rounded-lg bg-secondary border border-border pl-9 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label={t("common.clear")} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground"><X size={13} /></button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {list === null && [0, 1, 2].map((i) => <div key={i} className="h-11 rounded-lg bg-secondary animate-pulse m-1" />)}
        {list && list.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">{t("kairos.noChats")}</p>}
        {list && list.length > 0 && groups.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">{t("kairos.noMatch")}</p>}
        {groups.map(({ group, items }) => (
          <section key={group} className="mt-2 first:mt-0">
            <h3 className="px-3 pt-2 pb-1 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{t(GROUP_KEY[group])}</h3>
            <ul>
              {items.map((c) => {
                const active = c.id === activeId;
                return (
                  <li key={c.id} className="group relative" data-row-menu>
                    {editing === c.id ? (
                      <div className="flex items-center gap-1 px-2 py-1">
                        <input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => (e.key === "Enter" ? void commit(c.id) : e.key === "Escape" && setEditing(null))}
                          maxLength={120}
                          aria-label={t("paths.name")}
                          className="flex-1 min-w-0 h-8 rounded-md bg-secondary border border-primary px-2 text-[13px] text-foreground focus:outline-none"
                          autoFocus
                        />
                        <button onClick={() => void commit(c.id)} aria-label={t("common.save")} className="w-7 h-7 rounded-md flex items-center justify-center text-primary hover:bg-secondary"><Check size={15} /></button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => onOpen(c.id)}
                          aria-current={active ? "true" : undefined}
                          title={c.title}
                          className={`w-full text-left rounded-lg pl-3 pr-9 py-2 transition-colors ${active ? "bg-primary/10 text-foreground" : "hover:bg-secondary text-foreground/90"}`}
                        >
                          <span className={`block text-[13.5px] truncate ${active ? "font-semibold" : ""}`}>{c.title}</span>
                        </button>
                        <button
                          onClick={() => setMenuFor((m) => (m === c.id ? null : c.id))}
                          aria-haspopup="menu"
                          aria-expanded={menuFor === c.id}
                          aria-label={t("kairos.chatOptions", { title: c.title })}
                          className={`absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background focus:opacity-100 ${menuFor === c.id ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"} max-md:opacity-100`}
                        >
                          <MoreHorizontal size={15} />
                        </button>
                        {menuFor === c.id && (
                          <div role="menu" className="absolute right-1 top-9 z-30 w-40 rounded-xl border border-border bg-card shadow-xl p-1">
                            <button role="menuitem" onClick={() => (setMenuFor(null), setDraft(c.title), setEditing(c.id))} className="w-full flex items-center gap-2 px-2.5 h-8 rounded-lg text-[13px] text-foreground hover:bg-secondary"><Pencil size={13} /> {t("paths.rename")}</button>
                            <button role="menuitem" onClick={() => (setMenuFor(null), onDelete(c.id))} className="w-full flex items-center gap-2 px-2.5 h-8 rounded-lg text-[13px] text-destructive hover:bg-secondary"><Trash2 size={13} /> {t("cal.delete")}</button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {onClearAll && list && list.length > 0 && (
        <button onClick={onClearAll} className="mx-3 mb-3 text-left text-[12px] text-muted-foreground hover:text-destructive">{t("kairos.deleteAll")}</button>
      )}
    </div>
  );
}
