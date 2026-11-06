import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { api } from "../services/api";
import { mapBackendContentToItem } from "../lib/content";
import { useI18n } from "../lib/i18n";
import { ContentItem } from "../types/content";

const PAGE = 24;

/** Loads a filtered, searchable list page by page. `params` identifies the list:
 *  when it changes the list restarts. */
export function useResourceList(params: Record<string, string | undefined>, search: string) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [more, setMore] = useState(false);
  const seq = useRef(0);
  const key = JSON.stringify(params);

  const load = useCallback(
    async (offset: number) => {
      const mine = ++seq.current;
      setLoading(true);
      setError(false);
      try {
        const rows = await api.listContents({ ...JSON.parse(key), search: search.trim() || undefined, limit: PAGE, offset });
        if (mine !== seq.current) return; // a newer request superseded this one
        const mapped = rows.map(mapBackendContentToItem);
        setItems((prev) => (offset === 0 ? mapped : [...prev, ...mapped.filter((m) => !prev.some((p) => p.id === m.id))]));
        setMore(rows.length === PAGE);
      } catch {
        if (mine === seq.current) setError(true);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    },
    [key, search],
  );

  useEffect(() => {
    const t = window.setTimeout(() => void load(0), search ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, search]);

  return { items, loading, error, more, loadMore: () => load(items.length), retry: () => load(0) };
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:max-w-sm">
      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full h-10 bg-secondary border border-border rounded-full pl-10 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button onClick={() => onChange("")} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3.5 h-8 flex-shrink-0 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${active ? "bg-foreground text-background" : "bg-secondary text-foreground hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}

export function ListState({ loading, error, empty, onRetry, hasMore, onMore, count }: { loading: boolean; error: boolean; empty: string; onRetry: () => void; hasMore: boolean; onMore: () => void; count: number }) {
  const { t } = useI18n();
  if (error) {
    return (
      <div className="py-14 text-center text-sm text-muted-foreground">
        {t("common.couldNotLoad")} <button onClick={onRetry} className="text-primary underline">{t("common.retry")}</button>
      </div>
    );
  }
  if (loading && count === 0) {
    return (
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]" aria-busy="true">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-44 rounded-xl bg-secondary animate-pulse" />
        ))}
      </div>
    );
  }
  if (!loading && count === 0) return <p className="py-14 text-center text-sm text-muted-foreground">{empty}</p>;
  if (hasMore) {
    return (
      <div className="py-6 flex justify-center">
        <button onClick={onMore} disabled={loading} className="px-5 h-9 rounded-lg bg-secondary hover:bg-muted text-sm font-medium disabled:opacity-60">
          {loading ? t("common.loading") : t("common.loadMore")}
        </button>
      </div>
    );
  }
  return null;
}
