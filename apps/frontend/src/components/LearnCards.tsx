import { ArrowUpRight, BookOpen, FileText, GraduationCap, Map, MessageSquare, Puzzle, Users } from "lucide-react";
import { ContentItem } from "../types/content";
import { compact } from "./ContentCards";

/* Cards for Learn and Practice. Each is an outbound link to the source (the
   content is theirs), so every card names where it comes from. */

const DIFFICULTY: Record<string, { label: string; cls: string }> = {
  beginner: { label: "Beginner", cls: "bg-emerald-500/15 text-emerald-500" },
  easy: { label: "Easy", cls: "bg-sky-500/15 text-sky-500" },
  medium: { label: "Medium", cls: "bg-amber-500/15 text-amber-500" },
  hard: { label: "Hard", cls: "bg-rose-500/15 text-rose-500" },
};

export function DifficultyBadge({ level }: { level?: string }) {
  const d = level ? DIFFICULTY[level] : undefined;
  if (!d) return null;
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${d.cls}`}>{d.label}</span>;
}

function Shell({ item, icon, children, action }: { item: ContentItem; icon: React.ReactNode; children: React.ReactNode; action: string }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col h-full min-w-0 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-secondary/40 transition-colors p-4"
    >
      <span className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
        <span className="text-primary">{icon}</span>
        <span className="truncate">{item.source}</span>
      </span>
      {children}
      <span className="mt-auto pt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary">
        {action} <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </a>
  );
}

const Title = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[15px] font-semibold tracking-tight leading-snug text-foreground mt-2 line-clamp-2">{children}</span>
);
const Body = ({ children, lines = 3 }: { children: React.ReactNode; lines?: 2 | 3 | 4 }) => (
  <span className={`text-[13px] text-foreground/70 leading-relaxed mt-1.5 ${lines === 2 ? "line-clamp-2" : lines === 4 ? "line-clamp-4" : "line-clamp-3"}`}>{children}</span>
);
const Chips = ({ items }: { items?: string[] }) =>
  items && items.length > 0 ? (
    <span className="flex flex-wrap gap-1.5 mt-2.5">
      {items.slice(0, 4).map((t) => (
        <span key={t} className="px-2 py-0.5 rounded-full bg-secondary text-[11px] text-muted-foreground">
          {t}
        </span>
      ))}
    </span>
  ) : null;

export function RoadmapCard({ item }: { item: ContentItem }) {
  const m = item.meta ?? {};
  return (
    <Shell item={item} icon={<Map size={13} />} action="Open the roadmap">
      <Title>{item.title}</Title>
      <Body>{item.summary}</Body>
      <span className="flex items-center gap-2 mt-2.5 text-[12px] text-muted-foreground">
        {typeof m.topics === "number" && <span>{m.topics} topics</span>}
        {m.level === "beginner" && <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[11px] font-semibold">Beginner</span>}
      </span>
    </Shell>
  );
}

export function CourseCard({ item }: { item: ContentItem }) {
  const m = item.meta ?? {};
  const kind = m.kind === "certification" ? "Certification" : m.kind === "track" ? "Practice track" : "Learning path";
  return (
    <Shell item={item} icon={<GraduationCap size={13} />} action="Start learning">
      <Title>{item.title}</Title>
      <Body>{item.summary}</Body>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 text-[12px] text-muted-foreground">
        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">{kind}</span>
        {m.free && <span>Free</span>}
        {m.blocks ? <span>{m.blocks} modules</span> : null}
        {m.level === "beginner" && <DifficultyBadge level="beginner" />}
      </span>
    </Shell>
  );
}

export function DocCard({ item }: { item: ContentItem }) {
  const m = item.meta ?? {};
  return (
    <Shell item={item} icon={<BookOpen size={13} />} action="Read the docs">
      <Title>{item.title}</Title>
      <Body>{item.summary}</Body>
      <span className="block mt-2.5 text-[11px] text-muted-foreground">
        {m.attribution ? `© ${m.attribution}` : ""} {m.license ? `· ${m.license}` : ""}
      </span>
    </Shell>
  );
}

export function PaperCard({ item }: { item: ContentItem }) {
  const m = item.meta ?? {};
  const authors = (m.authors ?? []).slice(0, 3).join(", ") + ((m.authors?.length ?? 0) > 3 || m.moreAuthors ? " et al." : "");
  return (
    <div className="flex flex-col h-full min-w-0 rounded-xl border border-border bg-card p-4">
      <span className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
        <span className="text-primary"><FileText size={13} /></span>
        <span>arXiv{m.field ? ` · ${m.field}` : ""}</span>
        {m.kind === "survey" && <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary normal-case tracking-normal font-semibold">Survey</span>}
      </span>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[15px] font-semibold tracking-tight leading-snug text-foreground mt-2 line-clamp-3 hover:text-primary">
        {item.title}
      </a>
      {authors && <span className="block text-[12px] text-muted-foreground mt-1 truncate">{authors}</span>}
      <Body lines={4}>{item.summary}</Body>
      <span className="mt-auto pt-3 flex items-center gap-4 text-[12.5px] font-semibold">
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary">
          Abstract <ArrowUpRight size={13} />
        </a>
        {m.pdf && (
          <a href={m.pdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            PDF <ArrowUpRight size={13} />
          </a>
        )}
        {m.published && <span className="ml-auto font-normal text-muted-foreground">{new Date(m.published).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>}
      </span>
    </div>
  );
}

export function ExerciseCard({ item }: { item: ContentItem }) {
  const m = item.meta ?? {};
  return (
    <Shell item={item} icon={<Puzzle size={13} />} action={`Solve on ${m.platform ?? item.source}`}>
      <span className="flex items-center gap-2 mt-2">
        <DifficultyBadge level={m.difficulty} />
        {m.rating ? <span className="text-[11.5px] font-mono text-muted-foreground">{m.rating}</span> : null}
      </span>
      <Title>{item.title}</Title>
      <Body lines={2}>{item.summary}</Body>
      <Chips items={m.tags ?? (m.languages ? undefined : undefined)} />
      {m.solved ? (
        <span className="flex items-center gap-1 mt-2.5 text-[12px] text-muted-foreground">
          <Users size={12} /> {compact(m.solved)} solved
        </span>
      ) : null}
    </Shell>
  );
}

export function QuestionCard({ item }: { item: ContentItem }) {
  const m = item.meta ?? {};
  return (
    <Shell item={item} icon={<MessageSquare size={13} />} action="Read the answers">
      <Title>{item.title}</Title>
      <Body>{item.summary}</Body>
      <Chips items={m.tags} />
      <span className="flex items-center gap-3 mt-2.5 text-[12px] text-muted-foreground">
        <span className="text-foreground font-medium">▲ {compact(m.score)}</span>
        <span>{m.answers} answers</span>
        {m.views ? <span>{compact(m.views)} views</span> : null}
      </span>
      <span className="block mt-1.5 text-[11px] text-muted-foreground">
        © {m.attribution} · {m.license}
      </span>
    </Shell>
  );
}

/** Picks the card for a Learn/Practice item. */
export function ResourceCard({ item }: { item: ContentItem }) {
  switch (item.type) {
    case "roadmap":
      return <RoadmapCard item={item} />;
    case "course":
      return <CourseCard item={item} />;
    case "doc":
      return <DocCard item={item} />;
    case "paper":
      return <PaperCard item={item} />;
    case "exercise":
      return <ExerciseCard item={item} />;
    case "question":
      return <QuestionCard item={item} />;
    default:
      return null;
  }
}
