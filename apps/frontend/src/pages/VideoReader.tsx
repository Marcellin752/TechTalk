import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, Link2, Play, Star } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { ContentItem } from "../types/content";
import { mapBackendContentToItem } from "../lib/content";
import { CommentsPanel } from "../components/CommentsPanel";
import { compact, LanguageDot } from "../components/ContentCards";

interface VideoReaderProps {
  item: ContentItem;
  embedHtml: string;
  onBack: () => void;
  onSave: () => void;
  isSaved: boolean;
  onOpenItem: (item: ContentItem) => void;
}

type Tab = "next" | "projects" | "comments";

/* A watch page, laid out like a video site: the player and the video's details
   in the middle column, and a side column with what to watch next, related
   GitHub projects and the discussion. Only videos get this layout. */
export function VideoReader({ item, embedHtml, onBack, onSave, isSaved, onOpenItem }: VideoReaderProps) {
  const [tab, setTab] = useState<Tab>("next");
  const [more, setMore] = useState(false);
  const [next, setNext] = useState<ContentItem[] | null>(null);
  const [projects, setProjects] = useState<ContentItem[] | null>(null);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const categories = useMemo(() => item.categories?.slice(0, 2), [item.categories]);

  useEffect(() => {
    let cancelled = false;
    setNext(null);
    setProjects(null);
    setTab("next");
    setMore(false);
    const related = async (type: string, limit: number) => {
      const withCats = categories?.length ? await api.getContents(limit + 1, 0, undefined, type, categories) : [];
      const rows = withCats.length >= 3 ? withCats : await api.getContents(limit + 1, 0, undefined, type);
      return rows.map(mapBackendContentToItem).filter((i) => i.id !== item.id).slice(0, limit);
    };
    related("video", 14).then((r) => !cancelled && setNext(r)).catch(() => !cancelled && setNext([]));
    related("repo", 8).then((r) => !cancelled && setProjects(r)).catch(() => !cancelled && setProjects([]));
    return () => {
      cancelled = true;
    };
  }, [item.id, categories]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(item.url);
      toast.success("Link copied.");
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "next", label: "Up next" },
    { id: "projects", label: "Projects" },
    { id: "comments", label: commentCount === null ? "Comments" : `Comments · ${commentCount}` },
  ];

  const btn = "inline-flex items-center gap-2 h-9 px-4 rounded-full bg-secondary hover:bg-muted text-sm font-medium text-foreground transition-colors";

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0 bg-background/95 backdrop-blur-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>
        <span className="text-xs font-mono text-muted-foreground truncate max-w-[50%]">{item.source}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1500px] mx-auto px-4 lg:px-6 py-5 grid lg:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
          {/* Player + details */}
          <main className="min-w-0">
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black ring-1 ring-border">
              {embedHtml ? (
                <div className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full" dangerouslySetInnerHTML={{ __html: embedHtml }} />
              ) : (
                <>
                  <img src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center"
                    aria-label="Watch on the source site"
                  >
                    <span className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
                      <Play size={26} className="text-white fill-white ml-1" />
                    </span>
                  </a>
                </>
              )}
            </div>

            <h1 className="text-xl font-semibold text-foreground leading-snug mt-4">{item.title}</h1>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-sm text-foreground font-medium mr-auto">{item.source}</span>
              <button onClick={onSave} className={`${btn} ${isSaved ? "!bg-primary/15 !text-primary" : ""}`}>
                {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} {isSaved ? "Saved" : "Save"}
              </button>
              <button onClick={share} className={btn}>
                <Link2 size={16} /> Copy link
              </button>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className={btn}>
                <ExternalLink size={16} /> Source
              </a>
            </div>

            <div className="mt-4 rounded-xl bg-secondary p-4">
              <div className="text-xs font-medium text-foreground mb-2">
                {item.duration} · {item.date}
                {item.category ? ` · ${item.category}` : ""}
              </div>
              <p className={`text-sm text-foreground/85 leading-relaxed whitespace-pre-line ${more ? "" : "line-clamp-3"}`}>{item.summary}</p>
              {item.summary.length > 160 && (
                <button onClick={() => setMore((v) => !v)} className="text-xs font-semibold text-foreground mt-2 hover:underline">
                  {more ? "Show less" : "Show more"}
                </button>
              )}
              {item.categories && item.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {item.categories.map((c) => (
                    <span key={c} className="px-2.5 py-1 rounded-full bg-background text-xs text-muted-foreground border border-border">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </main>

          {/* Side column */}
          <aside className="min-w-0 lg:sticky lg:top-0">
            <div role="tablist" className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3.5 h-8 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors ${
                    tab === t.id ? "bg-foreground text-background" : "bg-secondary text-foreground hover:bg-muted"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="lg:max-h-[calc(100dvh-9.5rem)] lg:overflow-y-auto lg:pr-1 pb-10">
              {tab === "next" && <SideList items={next} empty="Nothing else to watch yet." render={(v) => <NextRow key={v.id} v={v} onOpen={() => onOpenItem(v)} />} />}
              {tab === "projects" && (
                <SideList items={projects} empty="No related projects yet." render={(r) => <ProjectRow key={r.id} r={r} onOpen={() => onOpenItem(r)} />} />
              )}
              {/* Mounted once opened, and kept so the count stays accurate. */}
              <div className={tab === "comments" ? "" : "hidden"}>
                <CommentsPanel contentId={item.id} onTotal={setCommentCount} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SideList<T>({ items, empty, render }: { items: T[] | null; empty: string; render: (i: T) => JSX.Element }) {
  if (items === null) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-40 aspect-video rounded-lg bg-secondary animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 rounded bg-secondary animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-secondary animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">{empty}</p>;
  return <div className="space-y-3">{items.map(render)}</div>;
}

function NextRow({ v, onOpen }: { v: ContentItem; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex gap-3 w-full text-left group">
      <span className="relative w-40 aspect-video rounded-lg overflow-hidden bg-secondary flex-shrink-0 ring-1 ring-border">
        <img src={v.image} alt="" loading="lazy" className="w-full h-full object-cover" />
        <span className="absolute bottom-1 right-1 text-[10px] font-medium text-white bg-black/80 px-1 rounded">{v.duration}</span>
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">{v.title}</span>
        <span className="block text-[11.5px] text-muted-foreground mt-1 truncate">{v.source}</span>
        <span className="block text-[11.5px] text-muted-foreground">{v.date}</span>
      </span>
    </button>
  );
}

function ProjectRow({ r, onOpen }: { r: ContentItem; onOpen: () => void }) {
  const m = r.meta ?? {};
  return (
    <button onClick={onOpen} className="flex gap-3 w-full text-left rounded-xl border border-border bg-card hover:border-primary/50 transition-colors p-3">
      {m.avatarUrl && <img src={m.avatarUrl} alt="" loading="lazy" className="w-9 h-9 rounded-md flex-shrink-0" />}
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[12.5px] truncate">
          <span className="text-muted-foreground">{m.owner}/</span>
          <span className="font-semibold text-foreground">{r.title.split("/")[1] ?? r.title}</span>
        </span>
        <span className="block text-[12px] text-foreground/70 line-clamp-2 mt-0.5">{r.summary}</span>
        <span className="flex items-center gap-3 mt-1.5 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 text-foreground">
            <Star size={11} className="fill-current text-primary" /> {compact(m.stars)}
          </span>
          <LanguageDot language={m.language} />
        </span>
      </span>
    </button>
  );
}
