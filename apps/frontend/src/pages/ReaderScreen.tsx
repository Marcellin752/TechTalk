import { ArrowLeft, Bookmark, BookmarkCheck, User } from "lucide-react";
import { ContentItem } from "../types/content";

interface ReaderScreenProps {
  item: ContentItem;
  onBack: () => void;
  onSave: () => void;
  isSaved: boolean;
}

const EMBED_ALLOWED_HOSTS = new Set(["youtube.com", "www.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

function sanitizeEmbedCode(html: string | null | undefined): string {
  if (!html) return "";
  const match = html.match(/<iframe[^>]*\bsrc=["']([^"']+)["']/i);
  if (!match) return "";
  try {
    const url = new URL(match[1]);
    if (!EMBED_ALLOWED_HOSTS.has(url.hostname)) return "";
    if (!url.pathname.startsWith("/embed/")) return "";
    return `<iframe title="Embedded video player" src="${url.toString()}" width="100%" height="100%" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  } catch {
    return "";
  }
}

export function ReaderScreen({
  item,
  onBack,
  onSave,
  isSaved,
}: ReaderScreenProps) {
  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border flex-shrink-0 bg-background/95 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>
        <button
          onClick={onSave}
          className={`flex items-center gap-1.5 text-sm transition-colors ${
            isSaved ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          <span className="text-xs font-mono">{isSaved ? "Saved" : "Save"}</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Video Player or Hero image */}
        <div className="relative bg-muted flex items-center justify-center overflow-hidden" style={{ height: "clamp(180px, 45vw, 360px)" }}>
          {item.type === "video" && item.embedCode ? (
            <div
              className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full"
              dangerouslySetInnerHTML={{ __html: sanitizeEmbedCode(item.embedCode) }}
            />
          ) : (
            <>
              <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
            </>
          )}
        </div>

        <div className="px-5 pt-5 pb-16 max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-[11px] font-mono text-primary uppercase tracking-[0.12em]">
              {item.category}
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {item.type === "video" ? item.duration : item.readTime}
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-[11px] text-muted-foreground font-mono">{item.date}</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground leading-tight mb-5">{item.title}</h1>

          <div className="flex items-center gap-3 pb-6 mb-6 border-b border-border">
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
              <User size={14} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{item.author}</div>
            </div>
          </div>

          {item.bodyHtml ? (
            <div
              className="article-body text-[15px] text-foreground/85 leading-[1.8]"
              dangerouslySetInnerHTML={{ __html: item.bodyHtml }}
            />
          ) : (
            item.body.split("\n\n").map((para, i) => (
              <p key={i} className="text-[15px] text-foreground/85 leading-[1.8] mb-5">
                {para}
              </p>
            ))
          )}

          {item.type !== "video" && (
            <div className="mt-8 pt-6 border-t border-border flex flex-col items-center">
              <p className="text-xs text-muted-foreground font-mono mb-4 text-center">
                This is a summarized preview. Read the full post on the publisher's website.
              </p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-all shadow-md shadow-primary/25"
              >
                Read on {item.source} ↗
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
