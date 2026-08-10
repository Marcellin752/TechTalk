import { useEffect, useRef, useState, type TouchEvent } from "react";
import { FeedCard } from "../components/FeedCard";
import { ContentItem } from "../types/content";

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
  contentType: "all" | "article" | "video";
  onFilterChange: (t: "all" | "article" | "video") => void;
}

const PULL_THRESHOLD = 72;

const FILTERS: { id: "all" | "article" | "video"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "article", label: "Articles" },
  { id: "video", label: "Videos" },
];

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
  onFilterChange,
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

  return (
    <div className="flex-1 overflow-y-auto" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} ref={scrollRef}>
      <div className="max-w-5xl mx-auto px-4 py-4 pb-8">
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
        <div className="flex items-center gap-2 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => onFilterChange(f.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                contentType === f.id
                  ? "bg-primary text-white shadow-sm shadow-primary/20"
                  : "bg-secondary text-muted-foreground border border-border hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Cards grid: 1 column on mobile, 2 on md+, 3 on xl+ */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              onOpen={() => onOpen(item)}
              onSave={() => onSave(item)}
              isSaved={savedIds.has(item.id)}
            />
          ))}
        </div>

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