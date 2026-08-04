import { useRef, useState, type TouchEvent } from "react";
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
}

const PULL_THRESHOLD = 72;

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
}: FeedScreenProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef<number | null>(null);

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
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-8">
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

        {items.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            onOpen={() => onOpen(item)}
            onSave={() => onSave(item)}
            isSaved={savedIds.has(item.id)}
          />
        ))}

        {!loading && !error && hasMore && items.length > 0 && (
          <div className="py-4 text-center">
            <button
              onClick={onLoadMore}
              className="px-6 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm font-semibold hover:bg-muted active:scale-95 transition-all shadow-sm"
            >
              Load More Tech Talks
            </button>
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