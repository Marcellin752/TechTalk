import { useState } from "react";
import { Bookmark, Sparkles, Play, Star, GitFork, Briefcase, GitPullRequest, ArrowUpRight, MapPin, Wallet } from "lucide-react";
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

export const LANGUAGE_COLORS: Record<string, string> = {
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

/** Why the "For you" feed picked this item, when it can say. */
function Reason({ text }: { text?: string | null }) {
  if (!text) return null;
  return (
    <span className="flex items-center gap-1 mt-1.5 text-[11.5px] text-primary leading-tight">
      <Sparkles size={11} className="flex-shrink-0" />
      <span className="truncate">{text}</span>
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
        <span className="relative block rounded-xl overflow-hidden ring-1 ring-border">
          <Thumb item={item} />
          <span className="absolute bottom-1.5 right-1.5 text-[11px] font-medium text-white bg-black/80 px-1.5 py-px rounded">
            {item.duration}
          </span>
        </span>
        <span className="block mt-2.5 pr-2">
          <span className="block text-[14px] font-medium leading-snug line-clamp-2 text-foreground">{item.title}</span>
          <span className="block text-[12px] text-muted-foreground mt-1 truncate">{item.source} · {item.date}</span>
          <Reason text={item.reason} />
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
        <Reason text={item.reason} />
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

/** An article is something to read: cover on top (wide and short, unlike a
 *  video), then source, headline, an excerpt and tags. No box and no panel, so
 *  it differs from both outlined projects and paneled video bands. */
export function ArticleCard({ item, onOpen, onSave, isSaved, className = "" }: CardProps & { className?: string }) {
  return (
    <article className={`group relative min-w-0 ${className}`}>
      <button onClick={onOpen} className="block w-full text-left outline-none" aria-label={item.title}>
        <span className="block rounded-xl overflow-hidden ring-1 ring-border">
          <Thumb item={item} className="aspect-[5/2]" />
        </span>
        <span className="flex items-center gap-2 mt-3.5 text-[11.5px]">
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-medium">{item.source}</span>
          <span className="text-muted-foreground">{item.readTime} read</span>
          <span className="text-muted-foreground">· {item.date}</span>
        </span>
        <span className="block text-[17px] font-bold tracking-tight leading-snug text-foreground mt-2 line-clamp-2 group-hover:text-primary transition-colors">
          {item.title}
        </span>
        <span className="block text-[13px] text-foreground/70 leading-relaxed mt-1.5 line-clamp-3">{item.summary}</span>
        {item.categories && item.categories.length > 0 && (
          <span className="flex flex-wrap gap-1.5 mt-2.5">
            {item.categories.slice(0, 2).map((c) => (
              <span key={c} className="text-[11px] text-muted-foreground">
                #{c.toLowerCase().replace(/[^a-z0-9]+/g, "")}
              </span>
            ))}
          </span>
        )}
        <Reason text={item.reason} />
      </button>
      <SaveButton onSave={onSave} isSaved={isSaved} />
    </article>
  );
}

/** A full-width strip that interrupts the feed with one opportunity: a remote
 *  job or a beginner-friendly issue to contribute to. It is deliberately a
 *  different shape from every card: horizontal, tinted, with a clear action. */
export function OpportunityBand({ item }: { item: ContentItem }) {
  const m = item.meta ?? {};
  const isJob = m.kind === "job";
  const [failed, setFailed] = useState(false);
  return (
    <aside
      aria-label="Opportunity"
      className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-5"
    >
      <span className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white ring-1 ring-border overflow-hidden flex items-center justify-center flex-shrink-0">
        {item.image && !failed ? (
          <img src={item.image} alt="" loading="lazy" onError={() => setFailed(true)} className="w-full h-full object-contain p-1.5" />
        ) : isJob ? (
          <Briefcase size={22} className="text-neutral-500" />
        ) : (
          <GitPullRequest size={22} className="text-neutral-500" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wide text-primary">
          {isJob ? <Briefcase size={12} /> : <GitPullRequest size={12} />}
          {isJob ? "Remote job" : "Open source · good first issue"}
        </div>
        <div className="text-[16px] font-bold tracking-tight text-foreground leading-snug mt-1 truncate">{item.title}</div>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 mt-1 text-[12.5px] text-muted-foreground">
          {isJob ? (
            <>
              {m.company && <span className="text-foreground/80 font-medium">{m.company}</span>}
              {m.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} /> {m.location}
                </span>
              )}
              {m.salary && (
                <span className="inline-flex items-center gap-1">
                  <Wallet size={12} /> {m.salary}
                </span>
              )}
            </>
          ) : (
            <>
              {m.repo && <span className="font-mono text-foreground/80">{m.repo}</span>}
              {m.labels?.map((l) => (
                <span key={l} className="px-2 py-0.5 rounded-full bg-secondary text-[11px]">
                  {l}
                </span>
              ))}
            </>
          )}
        </div>
        <p className="text-[13px] text-foreground/70 leading-snug mt-1.5 line-clamp-2">{item.summary}</p>
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-1.5 flex-shrink-0 bg-primary hover:bg-primary/90 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all shadow-md shadow-primary/25"
      >
        View <ArrowUpRight size={15} />
      </a>
    </aside>
  );
}

export function CardFor(props: CardProps) {
  if (props.item.type === "video") return <VideoCard {...props} />;
  // In a mixed grid a project spans two columns: wider than a video, never the same box.
  if (props.item.type === "opportunity") return <div className="sm:col-span-2 lg:col-span-4"><OpportunityBand item={props.item} /></div>;
  if (props.item.type === "repo") return <RepoCard {...props} className="sm:col-span-2" />;
  return <ArticleCard {...props} className="sm:col-span-2" />;
}
