import { useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Play,
  User,
  Rss,
  X,
  Check,
  Search,
  ChevronRight,
  Bell,
  Info,
  LogOut,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ContentSource = "Reddit" | "YouTube" | "Medium";
type ContentType = "article" | "video";

interface ContentItem {
  id: string;
  type: ContentType;
  source: ContentSource;
  title: string;
  summary: string;
  image: string;
  duration?: string;
  readTime?: string;
  author: string;
  category: string;
  body: string;
  views: string;
  date: string;
}

type AppScreen = "auth" | "onboarding" | "app";
type AppTab = "feed" | "saved" | "profile";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const FEED_ITEMS: ContentItem[] = [
  {
    id: "1",
    type: "article",
    source: "Medium",
    title: "Why Rust is Quietly Replacing C++ in Safety-Critical Systems",
    summary: "From aerospace to automotive, teams are switching. Here's what the data says.",
    image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=500&fit=crop&auto=format",
    readTime: "6 min",
    author: "Sara Okonkwo",
    category: "Systems",
    body: "Over the past three years, a quiet revolution has been unfolding in safety-critical software development. Rust, once dismissed as a niche systems language, has found its way into aerospace navigation systems, automotive braking controllers, and medical device firmware.\n\nThe numbers are hard to ignore. In a survey of 400 engineering teams working in regulated industries, 34% reported actively migrating from C or C++ to Rust. That's up from 9% two years ago. The driver isn't aesthetics — it's the compiler's ownership model, which eliminates entire classes of memory safety bugs at build time rather than runtime.\n\nFor teams operating under DO-178C or ISO 26262, the implications are significant. Fewer runtime failures means fewer field incidents, shorter certification cycles, and lower insurance liability. One aerospace contractor told me their defect rate dropped by 60% in modules rewritten in Rust — and that's before any additional testing.",
    views: "24.1k",
    date: "Jun 23",
  },
  {
    id: "2",
    type: "video",
    source: "YouTube",
    title: "React 19 Concurrent Features — Deep Dive",
    summary: "useTransition, Suspense boundaries, and the new compiler explained with live demos.",
    image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=500&fit=crop&auto=format",
    duration: "18:42",
    author: "Theo Browne",
    category: "Frontend",
    body: "React 19 shipped the compiler that removes the need for useMemo and useCallback in most cases. In this video we walk through the concurrent features added since React 18.\n\nWe cover: the new React Compiler and what it actually does under the hood, the updated Suspense model with streaming SSR, useTransition for non-blocking state updates, and the new server action primitives.\n\nLive demos throughout. We also benchmark a real dashboard component before and after the compiler — the results will surprise you.",
    views: "142k",
    date: "Jun 24",
  },
  {
    id: "3",
    type: "article",
    source: "Reddit",
    title: "I Built a 10x Faster PostgreSQL Query — Here's Exactly How",
    summary: "A query that took 8 seconds now runs in 80ms. The fix was embarrassingly simple.",
    image: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=500&fit=crop&auto=format",
    readTime: "4 min",
    author: "u/dbwizard99",
    category: "Database",
    body: "Three weeks ago I was debugging a dashboard that was timing out. The culprit: a single JOIN doing a sequential scan on 40 million rows.\n\nHere's the query (anonymized). The problem was a function call in the WHERE clause — specifically, LOWER() applied to an indexed column. PostgreSQL can't use a B-tree index when you wrap the column in a function. The fix? A functional index on LOWER(email). Query time: 8.2s → 78ms.\n\nThe broader lesson is to always check EXPLAIN ANALYZE before optimizing. I'd been adding composite indexes for 20 minutes trying to fix the wrong thing. Running the query plan first would have saved me an hour.",
    views: "18.7k",
    date: "Jun 22",
  },
  {
    id: "4",
    type: "video",
    source: "YouTube",
    title: "How Netflix Runs 1 Million+ Kubernetes Pods",
    summary: "Inside Netflix's container orchestration, autoscaling, and chaos engineering practices.",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=500&fit=crop&auto=format",
    duration: "31:15",
    author: "Netflix Engineering",
    category: "DevOps",
    body: "Netflix operates at a scale most engineers never encounter. At peak, we're running over a million Kubernetes pods across dozens of regions.\n\nIn this talk from KubeCon, our platform engineering team walks through the custom autoscaler we built on top of KEDA, how we handle region failover with sub-minute RPO, and the chaos engineering practices (Chaos Monkey, Latency Monkey) that keep our on-call team sane.\n\nWe also cover the organizational model — how 200+ microservice teams operate independently without stepping on each other in the same clusters.",
    views: "87k",
    date: "Jun 20",
  },
  {
    id: "5",
    type: "article",
    source: "Medium",
    title: "The Death of the Junior Developer: What AI Really Means for Entry-Level Roles",
    summary: "Companies report a 40% drop in junior hires. But the full picture is more nuanced.",
    image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&h=500&fit=crop&auto=format",
    readTime: "8 min",
    author: "Marcus Chen",
    category: "AI & Career",
    body: "The numbers are hard to ignore. Three major tech employers told me their junior engineering headcount dropped by 40% year-over-year. But is AI really the cause, or is this a cyclical correction masked by a convenient narrative?\n\nThe answer, after 40 interviews with hiring managers and recent bootcamp graduates, is: both, and neither cleanly.\n\nAI tools have raised the output bar for individual contributors. A mid-level engineer with Claude or Copilot can ship code at a pace that previously required a team. That compresses the number of seats needed at junior level — not because juniors can't produce, but because the marginal productivity of a third or fourth hire has dropped.\n\nBut there's a flip side. The teams cutting junior roles are often the same teams that will struggle in 18 months to promote from within.",
    views: "56.3k",
    date: "Jun 21",
  },
  {
    id: "6",
    type: "article",
    source: "Reddit",
    title: "We Migrated 300k Lines of C++ to WebAssembly — Here's What Happened",
    summary: "Performance went up 3x. Startup time dropped by 80%. The trade-offs were real.",
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&h=500&fit=crop&auto=format",
    readTime: "10 min",
    author: "u/wasm_pilgrim",
    category: "Web",
    body: "Eighteen months ago, 40% of our product ran as a native desktop app for performance reasons. Today, that same code runs in the browser via WebAssembly — and it's faster.\n\nThe migration was not painless. Emscripten gave us a good starting point but we hit walls around threading (SharedArrayBuffer restrictions), file system access, and exception handling overhead. We spent six weeks just on the allocator.\n\nThe payoff: our p95 load time went from 4.1s to 0.8s. Memory usage dropped 30%. And we killed two native codebases, one for macOS and one for Windows.",
    views: "31.2k",
    date: "Jun 19",
  },
  {
    id: "7",
    type: "video",
    source: "YouTube",
    title: "Claude 4 vs GPT-5: A Developer's Honest Benchmark",
    summary: "100 real-world coding tasks. Function calling, multi-step reasoning, and edge cases.",
    image: "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&h=500&fit=crop&auto=format",
    duration: "24:08",
    author: "Priya Anand",
    category: "AI",
    body: "I ran 100 real-world developer tasks through both models. Not cherry-picked benchmarks — actual problems from my last three months of work: debugging race conditions, writing regex for messy data, refactoring legacy PHP, generating OpenAPI specs from prose.\n\nThe results surprised me on several dimensions. Claude 4 consistently outperformed on long-context reasoning and multi-file refactors. GPT-5 had an edge on function-calling reliability and structured output adherence.\n\nNeither model is universally better. The right answer depends on your workflow.",
    views: "201k",
    date: "Jun 25",
  },
  {
    id: "8",
    type: "article",
    source: "Medium",
    title: "Stop Storing Secrets in .env Files",
    summary: "There's a better way to handle credentials in production. Here's what we switched to.",
    image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=500&fit=crop&auto=format",
    readTime: "5 min",
    author: "Felix Brandt",
    category: "Security",
    body: "Every week, another repo gets leaked with production secrets committed in a .env file. It's a solved problem. The tooling has existed for years. And yet.\n\nThe pattern that's worked best for our team: secrets manager (AWS Secrets Manager or HashiCorp Vault) injected at runtime by your orchestrator, never written to disk in the container. Local development uses a secrets proxy that authenticates via your SSO provider — no plain-text values anywhere.\n\nThe cost is real: more IAM complexity, slower local onboarding. But a single leaked database credential that takes down production for 6 hours is a much worse trade.",
    views: "43.9k",
    date: "Jun 18",
  },
];

const INTERESTS = [
  "AI & ML", "Frontend", "Backend", "DevOps", "Security",
  "Mobile", "Open Source", "Databases", "Career", "Systems", "Web3", "Design",
  "Performance", "Architecture",
];

const SOURCE_STYLES: Record<ContentSource, { chip: string; dot: string }> = {
  Reddit: { chip: "bg-orange-500/15 text-orange-400 border-orange-500/25", dot: "bg-orange-500" },
  YouTube: { chip: "bg-red-600/15 text-red-400 border-red-600/25", dot: "bg-red-500" },
  Medium: { chip: "bg-emerald-600/15 text-emerald-400 border-emerald-600/25", dot: "bg-emerald-500" },
};

// ─── Micro Components ─────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: ContentSource }) {
  const s = SOURCE_STYLES[source];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${s.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {source}
    </span>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────

function AuthScreen({ onAuth }: { onAuth: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      {/* Wordmark */}
      <div className="mb-14 text-center">
        <div className="flex items-center gap-2.5 justify-center mb-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Rss size={16} className="text-white" />
          </div>
          <span className="text-[26px] font-bold tracking-tight text-foreground">TechTalk</span>
        </div>
        <p className="text-muted-foreground text-sm font-mono tracking-wide">
          TikTok for tech — discover, scroll, learn.
        </p>
      </div>

      <div className="w-full max-w-sm">
        {/* Mode toggle */}
        <div className="flex bg-secondary rounded-xl p-1 mb-8 border border-border">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                mode === m
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {mode === "signup" && (
            <Field label="Name" type="text" placeholder="Alex Kim" />
          )}
          <Field label="Email" type="email" placeholder="you@example.com" />
          <Field label="Password" type="password" placeholder="••••••••" />

          <button
            onClick={onAuth}
            className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold text-sm mt-2 hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
          >
            {mode === "login" ? "Sign In →" : "Create Account →"}
          </button>

          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-mono">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button className="w-full border border-border bg-secondary text-foreground py-3 rounded-xl font-medium text-sm hover:bg-muted transition-colors flex items-center justify-center gap-2.5">
            <GoogleIcon />
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type, placeholder }: { label: string; type: string; placeholder: string }) {
  return (
    <div>
      <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-2 block">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
      />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

// ─── Onboarding Screen ────────────────────────────────────────────────────────

function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (i: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-12">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col">
        <div className="mb-1">
          <span className="text-[11px] font-mono text-primary uppercase tracking-[0.15em]">
            Almost there
          </span>
        </div>
        <h1 className="text-[32px] font-bold text-foreground mb-2 leading-tight">
          What are you<br />into?
        </h1>
        <p className="text-muted-foreground text-sm mb-10 leading-relaxed">
          Pick topics you care about. Your feed adapts instantly.
        </p>

        <div className="flex flex-wrap gap-2 mb-auto">
          {INTERESTS.map((interest) => {
            const on = selected.has(interest);
            return (
              <button
                key={interest}
                onClick={() => toggle(interest)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  on
                    ? "bg-primary border-primary text-white shadow-md shadow-primary/20"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                }`}
              >
                {on && <Check size={12} />}
                {interest}
              </button>
            );
          })}
        </div>

        <button
          onClick={onComplete}
          disabled={selected.size < 1}
          className="w-full bg-primary text-white py-4 rounded-2xl font-semibold text-sm mt-8 disabled:opacity-30 hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
        >
          Start Exploring →
        </button>
      </div>
    </div>
  );
}

// ─── Feed Card ────────────────────────────────────────────────────────────────

function FeedCard({
  item,
  onOpen,
  onSave,
  isSaved,
}: {
  item: ContentItem;
  onOpen: () => void;
  onSave: () => void;
  isSaved: boolean;
}) {
  return (
    <article className="bg-card border border-border rounded-2xl overflow-hidden group hover:border-border/60 transition-all">
      {/* Thumbnail */}
      <div
        className="relative aspect-[16/9] bg-muted overflow-hidden cursor-pointer"
        onClick={onOpen}
      >
        <img
          src={item.image}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
        />
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
          <span className="text-[11px] text-muted-foreground font-mono">{item.category}</span>
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

// ─── Reader Screen ────────────────────────────────────────────────────────────

function ReaderScreen({
  item,
  onBack,
  onSave,
  isSaved,
}: {
  item: ContentItem;
  onBack: () => void;
  onSave: () => void;
  isSaved: boolean;
}) {
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
        {/* Hero image */}
        <div className="relative bg-muted" style={{ height: "clamp(160px, 40vw, 280px)" }}>
          <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          {item.type === "video" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-2xl shadow-primary/40">
                <Play size={24} className="text-white fill-white ml-1" />
              </div>
            </div>
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

          {item.body.split("\n\n").map((para, i) => (
            <p key={i} className="text-[15px] text-foreground/85 leading-[1.8] mb-5">
              {para}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Feed Screen ──────────────────────────────────────────────────────────────

function FeedScreen({
  onOpen,
  onSave,
  savedIds,
}: {
  onOpen: (item: ContentItem) => void;
  onSave: (item: ContentItem) => void;
  savedIds: Set<string>;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-8">
        {FEED_ITEMS.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            onOpen={() => onOpen(item)}
            onSave={() => onSave(item)}
            isSaved={savedIds.has(item.id)}
          />
        ))}

        {/* Infinite load spinner */}
        <div className="py-8 flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground font-mono tracking-wide">
            Loading more...
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Saved Screen ─────────────────────────────────────────────────────────────

function SavedScreen({
  saved,
  onOpen,
  onRemove,
}: {
  saved: ContentItem[];
  onOpen: (item: ContentItem) => void;
  onRemove: (id: string) => void;
}) {
  const articles = saved.filter((i) => i.type === "article");
  const videos = saved.filter((i) => i.type === "video");

  if (saved.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center mb-5 shadow-inner">
          <Bookmark size={24} className="text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Nothing saved yet</h2>
        <p className="text-sm text-muted-foreground max-w-[220px] leading-relaxed">
          Tap the bookmark icon on any card to save it here.
        </p>
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
        {articles.length > 0 && <Section title="Articles" items={articles} />}
        {videos.length > 0 && <Section title="Videos" items={videos} />}
      </div>
    </div>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────────────

function ProfileScreen({ onLogout }: { onLogout: () => void }) {
  const stats = [
    { label: "Saved", value: "12" },
    { label: "Read", value: "48" },
    { label: "Streak", value: "7d" },
  ];

  const menuItems = [
    { label: "Settings", icon: <ChevronRight size={14} /> },
    { label: "Notifications", icon: <Bell size={14} /> },
    { label: "About TechTalk", icon: <Info size={14} /> },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-8 pb-10">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center mb-4 shadow-lg shadow-primary/10">
            <User size={32} className="text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Alex Kim</h2>
          <p className="text-sm text-muted-foreground font-mono mt-1">alex@example.com</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-secondary border border-border rounded-2xl p-4 text-center"
            >
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              <div className="text-[11px] text-muted-foreground font-mono mt-1 uppercase tracking-wide">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Interests */}
        <div className="mb-8">
          <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">
            My Interests
          </h3>
          <div className="flex flex-wrap gap-2">
            {["AI & ML", "Frontend", "Systems", "Security", "DevOps"].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 bg-secondary border border-border rounded-full text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
            <button className="px-3 py-1.5 bg-secondary border border-primary/30 rounded-full text-xs text-primary">
              + Edit
            </button>
          </div>
        </div>

        {/* Menu */}
        <div className="rounded-2xl border border-border overflow-hidden bg-card">
          {menuItems.map((item, idx) => (
            <button
              key={item.label}
              className={`w-full text-left px-4 py-3.5 text-sm text-foreground hover:bg-secondary transition-colors flex items-center justify-between ${
                idx < menuItems.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span>{item.label}</span>
              <span className="text-muted-foreground">{item.icon}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onLogout}
          className="w-full mt-3 text-left px-4 py-3.5 rounded-2xl text-sm text-red-400 hover:bg-secondary border border-border transition-colors flex items-center gap-2"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── Main App Shell ───────────────────────────────────────────────────────────

function MainApp({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<AppTab>("feed");
  const [reader, setReader] = useState<ContentItem | null>(null);
  const [saved, setSaved] = useState<ContentItem[]>([]);

  const savedIds = new Set(saved.map((i) => i.id));

  const toggleSave = (item: ContentItem) => {
    setSaved((prev) =>
      prev.find((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item]
    );
  };

  const tabs: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    { id: "feed", label: "Feed", icon: <Rss size={20} /> },
    { id: "saved", label: "Saved", icon: <Bookmark size={20} /> },
    { id: "profile", label: "Profile", icon: <User size={20} /> },
  ];

  const headerTitle: Record<AppTab, string> = {
    feed: "TechTalk",
    saved: "Saved",
    profile: "Profile",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-screen overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
        {tab === "feed" ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/30">
              <Rss size={13} className="text-white" />
            </div>
            <span className="text-[18px] font-bold tracking-tight text-foreground">TechTalk</span>
          </div>
        ) : (
          <h1 className="text-[18px] font-bold text-foreground">{headerTitle[tab]}</h1>
        )}
        {tab === "feed" && (
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-secondary">
            <Search size={18} />
          </button>
        )}
      </header>

      {/* Screen content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {tab === "feed" && (
          <FeedScreen onOpen={setReader} onSave={toggleSave} savedIds={savedIds} />
        )}
        {tab === "saved" && (
          <SavedScreen
            saved={saved}
            onOpen={setReader}
            onRemove={(id) => setSaved((prev) => prev.filter((i) => i.id !== id))}
          />
        )}
        {tab === "profile" && <ProfileScreen onLogout={onLogout} />}
      </div>

      {/* Bottom nav */}
      <nav className="bg-card border-t border-border px-2 py-2 flex flex-shrink-0 safe-area-pb">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className={`transition-transform duration-150 ${active ? "scale-110" : ""}`}>
                {t.icon}
              </div>
              <span className="text-[9px] font-mono uppercase tracking-widest">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Reader overlay */}
      {reader && (
        <ReaderScreen
          item={reader}
          onBack={() => setReader(null)}
          onSave={() => toggleSave(reader)}
          isSaved={savedIds.has(reader.id)}
        />
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("auth");

  return (
    <div className="dark min-h-screen bg-background">
      {screen === "auth" && <AuthScreen onAuth={() => setScreen("onboarding")} />}
      {screen === "onboarding" && <OnboardingScreen onComplete={() => setScreen("app")} />}
      {screen === "app" && <MainApp onLogout={() => setScreen("auth")} />}
    </div>
  );
}
