import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, FileText, GitFork, Scale, Star, CircleDot, Clock } from "lucide-react";
import { ContentItem } from "../types/content";
import { compact, LanguageDot } from "../components/ContentCards";

interface RepoReaderProps {
  item: ContentItem;
  onBack: () => void;
  onSave: () => void;
  isSaved: boolean;
}

function lastActivity(iso?: string): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 30) return `${days} d ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} y ago`;
}

/* A project page, not a video page: identity and numbers on top, the README as
   the main content, and a side column that answers "is this worth my time?". */
export function RepoReader({ item, onBack, onSave, isSaved }: RepoReaderProps) {
  const m = item.meta ?? {};
  const [owner, name] = item.title.includes("/") ? item.title.split("/") : [m.owner ?? "", item.title];

  const stats = [
    { icon: <Star size={15} className="text-primary" />, label: "Stars", value: compact(m.stars) },
    { icon: <GitFork size={15} />, label: "Forks", value: compact(m.forks) },
    { icon: <CircleDot size={15} />, label: "Open issues", value: compact((m as { openIssues?: number }).openIssues) },
    { icon: <Clock size={15} />, label: "Last push", value: lastActivity(m.pushedAt) },
  ];

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border flex-shrink-0 bg-background/95 backdrop-blur-sm">
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
        <div className="max-w-[1500px] mx-auto px-4 lg:px-8 py-6">
          {/* Identity */}
          <header className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            {m.avatarUrl && <img src={m.avatarUrl} alt="" className="w-14 h-14 rounded-xl border border-border" />}
            <div className="min-w-0 flex-1">
              <h1 className="font-mono text-xl sm:text-2xl leading-tight break-words">
                <span className="text-muted-foreground">{owner}/</span>
                <span className="font-bold text-foreground">{name}</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-3xl">{item.summary}</p>
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all shadow-md shadow-primary/25 flex-shrink-0"
            >
              View on GitHub <ExternalLink size={14} />
            </a>
          </header>

          {/* Numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
                  {s.icon} {s.label}
                </div>
                <div className="text-xl font-bold text-foreground mt-1">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
            {/* README */}
            <section className="rounded-xl border border-border bg-card overflow-hidden min-w-0">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/50 text-xs font-mono text-muted-foreground">
                <FileText size={14} /> README
              </div>
              {item.bodyHtml ? (
                <div className="article-body readme p-5 sm:p-7 text-[14.5px] text-foreground/90 leading-[1.75]" dangerouslySetInnerHTML={{ __html: item.bodyHtml }} />
              ) : (
                <p className="p-6 text-sm text-muted-foreground">No README available. Read it on GitHub.</p>
              )}
            </section>

            {/* About */}
            <aside className="space-y-5 lg:sticky lg:top-4">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3.5">
                <h2 className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">About</h2>
                {m.language && (
                  <div className="text-sm text-foreground">
                    <LanguageDot language={m.language} />
                  </div>
                )}
                {m.license && (
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Scale size={14} className="text-muted-foreground" /> {m.license} license
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Clock size={14} className="text-muted-foreground" /> Updated {lastActivity(m.pushedAt)}
                </div>
              </div>

              {m.topics && m.topics.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h2 className="text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-3">Topics</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {m.topics.map((t) => (
                      <span key={t} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
