import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Play,
  User,
  Rss,
  X,
  Search,
  ChevronRight,
  Bell,
  Info,
  LogOut,
} from "lucide-react";
import { api, User as ApiUser } from "../services/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type ContentSource = "Reddit" | "YouTube" | "Medium" | "Dev.to" | "TechCrunch";
type ContentType = "article" | "video" | "social_post";

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
  date: string;
  embedCode?: string | null;
}

type AppScreen = "auth" | "app";
type AppTab = "feed" | "saved" | "profile";

const SOURCE_STYLES: Record<string, { chip: string; dot: string }> = {
  Reddit: { chip: "bg-orange-500/15 text-orange-400 border-orange-500/25", dot: "bg-orange-500" },
  YouTube: { chip: "bg-red-600/15 text-red-400 border-red-600/25", dot: "bg-red-500" },
  Medium: { chip: "bg-emerald-600/15 text-emerald-400 border-emerald-600/25", dot: "bg-emerald-500" },
  "Dev.to": { chip: "bg-neutral-500/15 text-neutral-300 border-neutral-500/25", dot: "bg-neutral-400" },
  TechCrunch: { chip: "bg-lime-600/15 text-lime-400 border-lime-600/25", dot: "bg-lime-500" },
};

// ─── Sanitization ─────────────────────────────────────────────────────────────

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

// ─── Micro Components ─────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  const s = SOURCE_STYLES[source] || { chip: "bg-blue-600/15 text-blue-400 border-blue-600/25", dot: "bg-blue-500" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${s.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {source}
    </span>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────

function AuthScreen({ onAuthSuccess }: { onAuthSuccess: (user: ApiUser) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password || (mode === "signup" && !name)) {
      setError("Please fill out all fields.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await api.login(email, password);
        if (res.success && res.user) {
          onAuthSuccess(res.user);
        } else {
          setError(res.error || "Login failed");
        }
      } else {
        const res = await api.register(name, email, password);
        if (res.success) {
          // Auto sign in on registration success
          const loginRes = await api.login(email, password);
          if (loginRes.success && loginRes.user) {
            onAuthSuccess(loginRes.user);
          } else {
            setError("Account created! Please sign in manually.");
            setMode("login");
          }
        } else {
          setError(res.error || "Registration failed");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
              onClick={() => {
                setMode(m);
                setError(null);
              }}
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

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl mb-4 font-mono">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {mode === "signup" && (
            <Field label="Name" type="text" placeholder="Alex Kim" value={name} onChange={setName} />
          )}
          <Field label="Email" type="email" placeholder="you@example.com" value={email} onChange={setEmail} />
          <Field label="Password" type="password" placeholder="••••••••" value={password} onChange={setPassword} />

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold text-sm mt-2 hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign In →" : "Create Account →"}
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

function Field({
  label,
  type,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-2 block">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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

          {item.body.split("\n\n").map((para, i) => (
            <p key={i} className="text-[15px] text-foreground/85 leading-[1.8] mb-5">
              {para}
            </p>
          ))}

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

// ─── Feed Screen ──────────────────────────────────────────────────────────────

function FeedScreen({
  items,
  onOpen,
  onSave,
  savedIds,
  loading,
  error,
  onRetry,
}: {
  items: ContentItem[];
  onOpen: (item: ContentItem) => void;
  onSave: (item: ContentItem) => void;
  savedIds: Set<string>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-8">
        {items.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            onOpen={() => onOpen(item)}
            onSave={() => onSave(item)}
            isSaved={savedIds.has(item.id)}
          />
        ))}

        {loading && (
          <div className="py-8 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground font-mono tracking-wide">
              Loading technical feed...
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="py-12 text-center text-muted-foreground text-sm font-mono space-y-4">
            <div>{error}</div>
            <button
              onClick={onRetry}
              className="px-4 py-2 rounded-xl bg-secondary border border-border text-foreground hover:bg-muted transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm font-mono">
            No technical talks found. Check back later!
          </div>
        )}
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

function ProfileScreen({
  user,
  savedCount,
  onLogout,
}: {
  user: ApiUser | null;
  savedCount: number;
  onLogout: () => void;
}) {
  const stats = [
    { label: "Saved", value: savedCount.toString() },
    { label: "Read", value: "15" },
    { label: "Streak", value: "3d" },
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
          <h2 className="text-xl font-bold text-foreground">{user?.name || "Tech Enthusiast"}</h2>
          <p className="text-sm text-muted-foreground font-mono mt-1">{user?.email || "developer@teachtalk.com"}</p>
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

function mapBackendContentToItem(c: any): ContentItem {
  let image = "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=500&fit=crop&auto=format";
  let youtubeId = "";
  
  if (c.type === "video") {
    const match = c.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (match && match[1]) {
      youtubeId = match[1];
      image = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
    } else {
      image = "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=500&fit=crop&auto=format";
    }
  } else {
    if (c.source.toLowerCase().includes("techcrunch")) {
      image = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=500&fit=crop&auto=format";
    } else if (c.source.toLowerCase().includes("reddit")) {
      image = "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=500&fit=crop&auto=format";
    }
  }
  
  const wordCount = c.summary ? c.summary.split(/\s+/).length : 0;
  const readTime = c.type !== "video" ? `${Math.max(1, Math.round(wordCount / 180))} min` : undefined;
  
  let duration = undefined;
  if (c.type === "video") {
    const numericId = c.id.replace(/[^0-9]/g, '');
    const minutes = 3 + (parseInt(numericId.slice(0, 2) || '0', 10) % 15);
    const seconds = parseInt(numericId.slice(2, 4) || '0', 10) % 60;
    duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  let author = "Tech Talker";
  if (c.source.toLowerCase().includes("dev.to")) {
    author = "Dev.to Contributor";
  } else if (c.source.toLowerCase().includes("techcrunch")) {
    author = "TechCrunch Staff";
  } else if (c.source.toLowerCase().includes("youtube")) {
    author = "YouTube Technical Channel";
  } else if (c.source.toLowerCase().includes("reddit")) {
    author = "Reddit Contributor";
  }

  let category = "Technology";
  const titleLower = c.title.toLowerCase();
  if (titleLower.includes("typescript") || titleLower.includes("js") || titleLower.includes("react") || titleLower.includes("frontend")) {
    category = "Web Development";
  } else if (titleLower.includes("rust") || titleLower.includes("c++") || titleLower.includes("systems")) {
    category = "Systems";
  } else if (titleLower.includes("ai") || titleLower.includes("gpt") || titleLower.includes("claude") || titleLower.includes("intelligence")) {
    category = "AI";
  } else if (titleLower.includes("database") || titleLower.includes("postgres") || titleLower.includes("sql")) {
    category = "Databases";
  } else if (titleLower.includes("kubernetes") || titleLower.includes("docker") || titleLower.includes("aws") || titleLower.includes("devops")) {
    category = "DevOps";
  }

  return {
    id: c.id,
    type: c.type,
    source: c.source as any,
    title: c.title,
    summary: c.summary || "No description available.",
    image,
    duration,
    readTime,
    author,
    category,
    body: c.summary || "No full text available.",
    date: new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    embedCode: c.embedCode
  };
}

function MainApp({ user, onLogout }: { user: ApiUser | null; onLogout: () => void }) {
  const [tab, setTab] = useState<AppTab>("feed");
  const [reader, setReader] = useState<ContentItem | null>(null);
  const [saved, setSaved] = useState<ContentItem[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const savedIds = new Set(saved.map((i) => i.id));

  const loadFeed = async () => {
    setLoading(true);
    setFeedError(null);
    try {
      const backendContents = await api.getContents();
      const mappedItems = backendContents.map(mapBackendContentToItem);
      setItems(mappedItems);

      // Fetch bookmarks
      const backendBookmarks = await api.getBookmarks();
      const mappedBookmarks = backendBookmarks.map(mapBackendContentToItem);
      setSaved(mappedBookmarks);
    } catch (err) {
      console.error("Failed to fetch feed:", err);
      setFeedError("Unable to load the feed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const toggleSave = async (item: ContentItem) => {
    const isCurrentlySaved = saved.some((i) => i.id === item.id);
    if (isCurrentlySaved) {
      setSaved((prev) => prev.filter((i) => i.id !== item.id));
      await api.deleteBookmark(item.id);
    } else {
      setSaved((prev) => [...prev, item]);
      await api.addBookmark(item.id);
    }
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
          <FeedScreen
            items={items}
            onOpen={setReader}
            onSave={toggleSave}
            savedIds={savedIds}
            loading={loading}
            error={feedError}
            onRetry={loadFeed}
          />
        )}
        {tab === "saved" && (
          <SavedScreen
            saved={saved}
            onOpen={setReader}
            onRemove={async (id) => {
              setSaved((prev) => prev.filter((i) => i.id !== id));
              await api.deleteBookmark(id);
            }}
          />
        )}
        {tab === "profile" && <ProfileScreen user={user} savedCount={saved.length} onLogout={onLogout} />}
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
  const [screen, setScreen] = useState<AppScreen>(() => {
    return api.getToken() ? "app" : "auth";
  });
  const [user, setUser] = useState<ApiUser | null>(() => {
    return api.getUser();
  });

  const handleAuthSuccess = (authUser: ApiUser) => {
    setUser(authUser);
    setScreen("app");
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setScreen("auth");
  };

  return (
    <div className="dark min-h-screen bg-background">
      {screen === "auth" && <AuthScreen onAuthSuccess={handleAuthSuccess} />}
      {screen === "app" && <MainApp user={user} onLogout={handleLogout} />}
    </div>
  );
}
