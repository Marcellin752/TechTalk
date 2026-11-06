import { useEffect, useState } from "react";
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, Clock } from "lucide-react";
import { api } from "../services/api";
import { ContentItem } from "../types/content";
import { mapBackendContentToItem } from "../lib/content";

interface ArticleReaderProps {
  item: ContentItem;
  onBack: () => void;
  onSave: () => void;
  isSaved: boolean;
  onOpenItem: (item: ContentItem) => void;
}

/* An article page that uses the whole screen: the text takes the wide left
   column from the very top (no banner image pushing it down), and a side column
   carries the small cover, facts, tags and more to read. */
export function ArticleReader({ item, onBack, onSave, isSaved, onOpenItem }: ArticleReaderProps) {
  const [more, setMore] = useState<ContentItem[] | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMore(null);
    setImgFailed(false);
    api
      .getContents(6, 0, undefined, "article", item.categories?.slice(0, 2))
      .then((rows) => !cancelled && setMore(rows.map(mapBackendContentToItem).filter((a) => a.id !== item.id).slice(0, 4)))
      .catch(() => !cancelled && setMore([]));
    return () => {
      cancelled = true;
    };
  }, [item.id, item.categories]);

  const paragraphs = item.body.split("\n\n");
  const cta = "inline-flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all shadow-md shadow-primary/25";

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0 bg-background/95 backdrop-blur-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>
        <button
          onClick={onSave}
          className={`flex items-center gap-1.5 text-sm transition-colors ${isSaved ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          <span className="text-xs font-mono">{isSaved ? "Saved" : "Save"}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-7 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-10 items-start">
          <article className="min-w-0 max-w-5xl">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-[1.15]">{item.title}</h1>
            {item.bodyHtml && item.summary && <p className="text-lg text-muted-foreground leading-relaxed mt-4">{item.summary}</p>}

            <div className="mt-7 pt-7 border-t border-border">
              {item.bodyHtml ? (
                <div className="article-body text-[16.5px] text-foreground/90 leading-[1.8]" dangerouslySetInnerHTML={{ __html: item.bodyHtml }} />
              ) : (
                paragraphs.map((para, i) => (
                  <p key={i} className="text-[16.5px] text-foreground/90 leading-[1.8] mb-5">
                    {para}
                  </p>
                ))
              )}
            </div>
          </article>

          <aside className="space-y-5 lg:sticky lg:top-0 min-w-0 pb-10">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {item.image && !imgFailed && (
                <img src={item.image} alt="" onError={() => setImgFailed(true)} className="w-full aspect-[16/9] object-cover border-b border-border" />
              )}
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono font-medium">{item.source}</span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock size={12} /> {item.readTime} read
                  </span>
                  <span className="text-muted-foreground">· {item.date}</span>
                </div>
                {item.categories && item.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.categories.map((c) => (
                      <span key={c} className="px-2.5 py-1 rounded-full bg-secondary text-xs text-muted-foreground">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                <a href={item.url} target="_blank" rel="noopener noreferrer" className={cta}>
                  Open on {item.source} <ExternalLink size={14} />
                </a>
              </div>
            </div>

            {more && more.length > 0 && (
              <div>
                <h2 className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-3">More to read</h2>
                <div className="space-y-1">
                  {more.map((a) => (
                    <button key={a.id} onClick={() => onOpenItem(a)} className="block w-full text-left rounded-lg p-2.5 -mx-2.5 hover:bg-secondary transition-colors">
                      <span className="block text-[13.5px] font-semibold text-foreground leading-snug line-clamp-2">{a.title}</span>
                      <span className="block text-[11.5px] text-muted-foreground mt-1">
                        {a.source} · {a.readTime} read
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
