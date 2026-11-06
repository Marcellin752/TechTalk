import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { ArticleCard, CardFor, OpportunityBand, RepoCard } from "../components/ContentCards";
import { buildSections, type SectionKind } from "../lib/feedLayout";
import { ContentItem } from "../types/content";

export type FeedMode = "foryou" | "latest";
export type FeedFilter = "all" | "article" | "video" | "repo" | "opportunity";

interface FeedScreenProps {
  items: ContentItem[];
  onOpen: (item: ContentItem) => void;
  onSave: (item: ContentItem) => void;
  savedIds: Set<string>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  hasMore: boolean;
  onLoadMore: () => void;
  contentType: FeedFilter;
  feedMode: FeedMode;
  onFeedModeChange: (m: FeedMode) => void;
  onFilterChange: (t: FeedFilter) => void;
  searchQuery?: string;
}

const PULL_THRESHOLD = 72;

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "video", label: "Videos" },
  { id: "repo", label: "Projects" },
  { id: "article", label: "Articles" },
  { id: "opportunity", label: "Opportunities" },
];

const SECTION_TITLES: Record<SectionKind, string | null> = {
  videos: null,
  opportunity: null,
  repos: "Projects worth exploring",
  articles: "Worth a read",
};

const ROW_GRID: Record<SectionKind, string> = {
  opportunity: "grid-cols-1",
  videos: "grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4",
  repos: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4",
  articles: "grid-cols-1 md:grid-cols-3 gap-6",
};

export function FeedScreen({
  items,
  onOpen,
  onSave,
  savedIds,
  loading,
  error,
  onRetry,
  hasMore,
  onLoadMore,
  contentType,
  feedMode,
  onFeedModeChange,
  onFilterChange,
  searchQuery = "",
}: FeedScreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef<number | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const shouldObserve = !loading && !error && hasMore && items.length > 0;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !shouldObserve) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldObserve, onLoadMore, items.length, contentType]);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) return;
    pullStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (pullStartY.current === null) return;
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0 && !loading && !error) {
      setPullDistance(Math.min(delta * 0.5, PULL_THRESHOLD + 40));
    }
  };

  const handleTouchEnd = () => {
    pullStartY.current = null;
    if (pullDistance >= PULL_THRESHOLD && !loading && !error) {
      onRetry();
    }
    setPullDistance(0);
  };

  const refreshing = pullDistance >= PULL_THRESHOLD;
  const flat = contentType !== "all" || !!searchQuery.trim();
  const sections = useMemo(() => (flat ? [] : buildSections(items, !hasMore)), [flat, items, hasMore]);

  return (
    <div className="flex-1 overflow-y-auto" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} ref={scrollRef}>
      <div className="max-w-7xl mx-auto px-4 py-4 pb-8">
        {/* Pull-to-refresh indicator */}
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-200"
          style={{ height: pullDistance }}
        >
          <div
            className={`w-6 h-6 border-2 border-primary/20 rounded-full ${
              refreshing ? "border-t-primary animate-spin" : "border-t-primary"
            }`}
            style={{ transform: `rotate(${pullDistance * 3}deg)` }}
          />
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
          {!searchQuery.trim() && (
            <div role="radiogroup" aria-label="Feed order" className="flex flex-shrink-0 rounded-lg border border-border bg-secondary p-0.5 mr-2">
              {([["foryou", "For you"], ["latest", "Latest"]] as const).map(([id, label]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={feedMode === id}
                  onClick={() => onFeedModeChange(id)}
                  className={`px-3 h-7 rounded-md text-[13px] font-medium transition-colors ${
                    feedMode === id ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => onFilterChange(f.id)}
              className={`px-3.5 h-8 flex-shrink-0 rounded-lg text-[13px] font-medium transition-colors ${
                contentType === f.id
                  ? "bg-foreground text-background"
                  : "bg-secondary text-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {searchQuery.trim() && !loading && !error && items.length > 0 && (
          <p className="text-xs text-muted-foreground font-mono mb-4">
            {items.length}{hasMore ? "+" : ""} results for “{searchQuery.trim()}”
          </p>
        )}

        {flat ? (
          /* Searching or filtering: one even grid, every card in its own format. */
          <div className={`grid gap-x-4 gap-y-6 ${contentType === "repo" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : contentType === "opportunity" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"}`}>
            {items.map((item) =>
              contentType === "opportunity" ? (
                <OpportunityBand key={item.id} item={item} />
              ) : contentType === "repo" ? (
                <RepoCard key={item.id} item={item} onOpen={() => onOpen(item)} onSave={() => onSave(item)} isSaved={savedIds.has(item.id)} />
              ) : (
                <CardFor key={item.id} item={item} onOpen={() => onOpen(item)} onSave={() => onSave(item)} isSaved={savedIds.has(item.id)} />
              ),
            )}
          </div>
        ) : (
          /* Home: rows that alternate format, like a video site's shelves. */
          <div className="space-y-9">
            {sections.map((section, i) => (
              <section
                key={`${section.kind}-${i}`}
                // Video bands sit on a soft panel; project shelves use outlined cards instead.
                className={section.kind === "videos" ? "rounded-2xl bg-secondary/60 p-3 sm:p-4" : undefined}
              >
                {SECTION_TITLES[section.kind] && (
                  <h2 className="text-[15px] font-semibold text-foreground mb-3.5">{SECTION_TITLES[section.kind]}</h2>
                )}
                <div className={`grid ${ROW_GRID[section.kind]}`}>
                  {section.items.map((item) =>
                    section.kind === "opportunity" ? (
                      <OpportunityBand key={item.id} item={item} />
                    ) : section.kind === "repos" ? (
                      <RepoCard key={item.id} item={item} onOpen={() => onOpen(item)} onSave={() => onSave(item)} isSaved={savedIds.has(item.id)} />
                    ) : section.kind === "articles" ? (
                      <ArticleCard key={item.id} item={item} onOpen={() => onOpen(item)} onSave={() => onSave(item)} isSaved={savedIds.has(item.id)} />
                    ) : (
                      <CardFor key={item.id} item={item} onOpen={() => onOpen(item)} onSave={() => onSave(item)} isSaved={savedIds.has(item.id)} />
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        {!loading && !error && hasMore && items.length > 0 && (
          <div ref={sentinelRef} className="py-4 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {loading && (
          <div className="py-8 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground font-mono tracking-wide">
              Loading technical feed...
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="py-12 text-center text-muted-foreground text-sm font-mono space-y-4">
            <div>{error}</div>
            <button
              onClick={onRetry}
              className="px-4 py-2 rounded-xl bg-secondary border border-border text-foreground hover:bg-muted transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm font-mono">
            No technical talks found. Check back later!
          </div>
        )}
      </div>
    </div>
  );
}