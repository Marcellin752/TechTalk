import { ArrowLeft, Bookmark, X } from "lucide-react";
import { ContentItem } from "../types/content";

interface SavedScreenProps {
  saved: ContentItem[];
  onOpen: (item: ContentItem) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
  error?: string | null;
}

export function SavedScreen({
  saved,
  onOpen,
  onRemove,
  onBack,
  error,
}: SavedScreenProps) {
  const articles = saved.filter((i) => i.type !== "video");
  const videos = saved.filter((i) => i.type === "video");

  if (error && saved.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center mb-5 shadow-inner">
          <Bookmark size={24} className="text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Couldn't load your saves</h2>
        <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
          {error}. Check your connection and try again.
        </p>
      </div>
    );
  }

  if (saved.length === 0) {
    return (
      <div className="flex-1 flex flex-col px-6 py-5 text-center">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-16"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back to Feed</span>
        </button>
        <div className="flex flex-col items-center px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center mb-5 shadow-inner">
            <Bookmark size={24} className="text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Nothing saved yet</h2>
          <p className="text-sm text-muted-foreground max-w-[220px] leading-relaxed">
            Tap the bookmark icon on any card to save it here.
          </p>
        </div>
      </div>
    );
  }

  function Section({ title, items }: { title: string; items: ContentItem[] }) {
    return (
      <div>
        <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">
          {title} · {items.length}
        </h3>
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex gap-3 p-3 rounded-xl bg-secondary border border-border group hover:border-primary/20 transition-all"
            >
              <div
                className="w-20 h-[56px] rounded-lg bg-muted overflow-hidden flex-shrink-0 cursor-pointer"
                onClick={() => onOpen(item)}
              >
                <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpen(item)}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[11px] font-mono text-muted-foreground">{item.category}</span>
                </div>
                <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                  {item.title}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono mt-1">
                  {item.type === "video" ? item.duration : item.readTime}
                </p>
              </div>
              <button
                onClick={() => onRemove(item.id)}
                className="self-start p-1.5 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5">
      <div className="max-w-lg mx-auto space-y-8 pb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back to Feed</span>
        </button>
        {articles.length > 0 && <Section title="Articles & Posts" items={articles} />}
        {videos.length > 0 && <Section title="Videos" items={videos} />}
      </div>
    </div>
  );
}
