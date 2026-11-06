import { useState } from "react";
import { Bookmark, Play, Star, GitFork } from "lucide-react";
import { ContentItem } from "../types/content";

/* Three card formats, one visual language. The feed mixes them in rows:
   VideoCard (16:9 thumbnail), RepoCard (project preview) and ArticleCard
   (text first, small thumbnail). All share the same corner radius, type scale
   and hover behaviour so the page reads as one system. */

export function compact(n: number | undefined): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")} k`;
  return String(n);
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Rust: "#dea584",
  Go: "#00add8",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#8a8a8a",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4f5d95",
  Swift: "#f05138",
  Kotlin: "#a97bff",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  Jupyter: "#da5b0b",
};

export function LanguageDot({ language }: { language?: string | null }) {
  if (!language) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: LANGUAGE_COLORS[language] ?? "#7c7c86" }} />
      {language}
    </span>
  );
}

interface CardProps {
  item: ContentItem;
  onOpen: () => void;
  onSave?: () => void;
  isSaved?: boolean;
}

function SaveButton({ onSave, isSaved }: Pick<CardProps, "onSave" | "isSaved">) {
  if (!onSave) return null;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSave();
      }}
      aria-label={isSaved ? "Remove from saved" : "Save"}
      className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center bg-black/55 backdrop-blur-sm transition-opacity ${
        isSaved ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-100 focus:opacity-100 text-white"
      }`}
    >
      <Bookmark size={15} className={isSaved ? "fill-current" : ""} />
    </button>
  );
}

function Thumb({ item, className = "aspect-video" }: { item: ContentItem; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`relative block ${className} overflow-hidden bg-secondary`}>
      {failed ? (
        <span className="w-full h-full flex items-center justify-center">
          <Play size={26} className="text-muted-foreground/50" />
        </span>
      ) : (
        <img src={item.image} alt="" loading="lazy" onError={() => setFailed(true)} className="w-full h-full object-cover" />
      )}
    </span>
  );
}

export function VideoCard({ item, onOpen, onSave, isSaved }: CardProps) {
  return (
    <article className="group relative min-w-0">
      <button onClick={onOpen} className="block w-full text-left outline-none" aria-label={item.title}>
        <span className="relative block rounded-xl overflow-hidden">
          <Thumb item={item} />
          <span className="absolute bottom-1.5 right-1.5 text-[11px] font-medium text-white bg-black/80 px-1.5 py-px rounded">
            {item.duration}
          </span>
        </span>
        <span className="block mt-2.5 pr-2">
          <span className="block text-[14px] font-medium leading-snug line-clamp-2 text-foreground">{item.title}</span>
          <span className="block text-[12px] text-muted-foreground mt-1 truncate">{item.source} · {item.date}</span>
        </span>
      </button>
      <SaveButton onSave={onSave} isSaved={isSaved} />
    </article>
  );
}

/** A project is not a video: no thumbnail, wider and shorter, text and numbers
 *  first, the way a repository reads on GitHub itself. */
export function RepoCard({ item, onOpen, onSave, isSaved, className = "" }: CardProps & { className?: string }) {
  const m = item.meta ?? {};
  const [owner, name] = item.title.includes("/") ? item.title.split("/") : [m.owner ?? "", item.title];
  return (
    <article className={`group relative min-w-0 ${className}`}>
      <button
        onClick={onOpen}
        className="flex flex-col w-full h-full min-h-[176px] text-left outline-none rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-secondary/40 transition-colors p-4"
        aria-label={item.title}
      >
        <span className="flex items-center gap-2.5 min-w-0 pr-8">
          {m.avatarUrl ? (
            <img src={m.avatarUrl} alt="" loading="lazy" className="w-7 h-7 rounded-md flex-shrink-0" />
          ) : (
            <span className="w-7 h-7 rounded-md bg-secondary flex-shrink-0" />
          )}
          <span className="font-mono text-[13px] truncate">
            <span className="text-muted-foreground">{owner}/</span>
            <span className="text-foreground font-semibold">{name}</span>
          </span>
        </span>
        <span className="block text-[13px] text-foreground/70 leading-relaxed mt-3 line-clamp-3">{item.summary}</span>
        {m.topics && m.topics.length > 0 && (
          <span className="flex flex-wrap gap-1.5 mt-3">
            {m.topics.slice(0, 3).map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-mono">
                {t}
              </span>
            ))}
          </span>
        )}
        <span className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-auto pt-3.5 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 text-foreground font-medium">
            <Star size={13} className="fill-current text-primary" /> {compact(m.stars)}
          </span>
          {m.forks ? (
            <span className="inline-flex items-center gap-1">
              <GitFork size={13} /> {compact(m.forks)}
            </span>
          ) : null}
          <LanguageDot language={m.language} />
          {m.license && <span className="font-mono">{m.license}</span>}
        </span>
      </button>
      <SaveButton onSave={onSave} isSaved={isSaved} />
    </article>
  );
}

export function ArticleCard({ item, onOpen, onSave, isSaved, className = "" }: CardProps & { className?: string }) {
  return (
    <article className={`group relative min-w-0 ${className}`}>
      <button
        onClick={onOpen}
        className="flex gap-3.5 w-full text-left outline-none rounded-xl p-2.5 -m-2.5 hover:bg-secondary/70 transition-colors"
        aria-label={item.title}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-mono text-muted-foreground uppercase tracking-wide">{item.source}</span>
          <span className="block text-[15px] font-semibold leading-snug line-clamp-2 text-foreground mt-1">{item.title}</span>
          <span className="block text-[12.5px] text-muted-foreground leading-snug line-clamp-2 mt-1.5">{item.summary}</span>
          <span className="block text-[11.5px] text-muted-foreground mt-2">
            {item.readTime} read · {item.date}
          </span>
        </span>
        <span className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-lg overflow-hidden">
          <Thumb item={item} className="w-full h-full" />
        </span>
      </button>
      <SaveButton onSave={onSave} isSaved={isSaved} />
    </article>
  );
}

export function CardFor(props: CardProps) {
  if (props.item.type === "video") return <VideoCard {...props} />;
  // In a mixed grid a project spans two columns: wider than a video, never the same box.
  if (props.item.type === "repo") return <RepoCard {...props} className="sm:col-span-2" />;
  return <ArticleCard {...props} className="sm:col-span-2" />;
}
