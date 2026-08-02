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
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-8">
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
