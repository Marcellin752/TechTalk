import { useState } from "react";
import { Play, User, Bookmark, BookmarkCheck } from "lucide-react";
import { ContentItem } from "../types/content";
import { SourceBadge } from "./SourceBadge";

interface FeedCardProps {
  item: ContentItem;
  onOpen: () => void;
  onSave: () => void;
  isSaved: boolean;
}

export function FeedCard({
  item,
  onOpen,
  onSave,
  isSaved,
}: FeedCardProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <article className="bg-card border border-border rounded-2xl overflow-hidden group hover:border-border/60 transition-all">
      {/* Thumbnail */}
      <div
        className="relative aspect-[16/9] bg-muted overflow-hidden cursor-pointer"
        onClick={onOpen}
      >
        {imgFailed ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-muted">
            <Play size={28} className="text-muted-foreground/40" />
          </div>
        ) : (
          <img
            src={item.image}
            alt={item.title}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {item.type === "video" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-xl">
              <Play size={20} className="text-white fill-white ml-1" />
            </div>
          </div>
        )}

        <div className="absolute bottom-3 right-3">
          <span className="text-[11px] font-mono text-white/80 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md">
            {item.type === "video" ? item.duration : item.readTime}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 cursor-pointer" onClick={onOpen}>
        <div className="flex items-center gap-2 mb-3">
          <SourceBadge source={item.source} />
          <span className="text-[11px] text-muted-foreground font-mono ml-auto">{item.date}</span>
        </div>

        <h2 className="text-[15px] font-semibold text-foreground leading-snug mb-2 line-clamp-2">
          {item.title}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {item.summary}
        </p>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
            <User size={10} className="text-primary" />
          </div>
          <span className="text-xs text-muted-foreground">{item.author}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className={`p-2 rounded-lg transition-all hover:scale-110 ${
              isSaved ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          </button>
        </div>
      </div>
    </article>
  );
}
