import { useState, useEffect, useRef } from "react";
import { Rss, Search, Bookmark, User, X } from "lucide-react";
import { Toaster } from "sonner";
import { api, User as ApiUser } from "../services/api";

// Types
import { ContentItem, AppScreen, AppTab } from "../types/content";

// Pages
import { AuthScreen } from "../pages/AuthScreen";
import { FeedScreen } from "../pages/FeedScreen";
import { SavedScreen } from "../pages/SavedScreen";
import { ProfileScreen } from "../pages/ProfileScreen";
import { ReaderScreen } from "../pages/ReaderScreen";

// ─── Content Mapping Helper ──────────────────────────────────────────────────

function mapBackendContentToItem(c: any): ContentItem {
  let image = c.image || "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=500&fit=crop&auto=format";
  let youtubeId = "";
  
  if (c.type === "video") {
    const match = c.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (match && match[1]) {
      youtubeId = match[1];
      image = c.image || `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
    } else if (!c.image) {
      image = "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=500&fit=crop&auto=format";
    }
  } else {
    if (!c.image) {
      if (c.source.toLowerCase().includes("techcrunch")) {
        image = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=500&fit=crop&auto=format";
      } else if (c.source.toLowerCase().includes("reddit")) {
        image = "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=500&fit=crop&auto=format";
      }
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

// ─── Main App Shell ───────────────────────────────────────────────────────────

function MainApp({ user, onLogout }: { user: ApiUser | null; onLogout: () => void }) {
  const [tab, setTab] = useState<AppTab>("feed");
  const [reader, setReader] = useState<ContentItem | null>(null);
  const [saved, setSaved] = useState<ContentItem[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  
  // Search & Pagination States
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Read items tracking (ids) + streak tracking (read dates)
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    const raw = localStorage.getItem("teachtalk_read_ids");
    if (!raw) return new Set();
    try {
      return new Set(JSON.parse(raw));
    } catch {
      return new Set();
    }
  });

  const [readDates, setReadDates] = useState<string[]>(() => {
    const raw = localStorage.getItem("teachtalk_read_dates");
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const todayKey = () => new Date().toISOString().slice(0, 10);

  const handleOpenReader = (item: ContentItem) => {
    setReader(item);
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      localStorage.setItem("teachtalk_read_ids", JSON.stringify(Array.from(next)));
      return next;
    });
    setReadDates((prev) => {
      const key = todayKey();
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      localStorage.setItem("teachtalk_read_dates", JSON.stringify(next));
      return next;
    });
  };

  const [interests, setInterests] = useState<string[]>(() => {
    const raw = localStorage.getItem("teachtalk_interests");
    return raw ? JSON.parse(raw) : ["AI & ML", "Frontend", "Systems", "Security", "DevOps"];
  });

  const handleToggleInterest = (interest: string) => {
    setInterests((prev) => {
      const next = prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest];
      localStorage.setItem("teachtalk_interests", JSON.stringify(next));
      return next;
    });
  };

  const savedIds = new Set(saved.map((i) => i.id));

  const loadFeed = async () => {
    setLoading(true);
    setFeedError(null);
    try {
      const backendContents = await api.getContents(50, 0);
      const mappedItems = backendContents.map(mapBackendContentToItem);
      setItems(mappedItems);
      setOffset(0);
      setHasMore(backendContents.length >= 50);
    } catch (err) {
      console.error("Failed to fetch feed:", err);
      setFeedError("Unable to load the feed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadBookmarks = async () => {
    setSavedError(null);
    try {
      const backendBookmarks = await api.getBookmarks();
      const mappedBookmarks = backendBookmarks.map(mapBackendContentToItem);
      setSaved(mappedBookmarks);
    } catch (err) {
      console.error("Failed to fetch bookmarks:", err);
      setSavedError("Unable to load your bookmarks");
    }
  };

  // Server-side search with debounce. Clears results & reloads feed when empty.
  const searchDebounceRef = useRef<number | null>(null);

  const runSearch = async (term: string) => {
    const trimmed = term.trim();
    setLoading(true);
    setFeedError(null);
    try {
      if (!trimmed) {
        // No keyword: load the normal initial feed
        const backendContents = await api.getContents(50, 0);
        setItems(backendContents.map(mapBackendContentToItem));
        setOffset(0);
        setHasMore(backendContents.length >= 50);
        return;
      }
      const results = await api.getContents(50, 0, trimmed);
      setItems(results.map(mapBackendContentToItem));
      setOffset(0);
      setHasMore(results.length >= 50);
    } catch (err) {
      console.error("Failed to search feed:", err);
      setFeedError("Search failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
    }
    const q = searchQuery.trim();
    if (!q) {
      // Immediate reload of the normal feed when the search is emptied
      runSearch("");
      return;
    }
    searchDebounceRef.current = window.setTimeout(() => runSearch(q), 350);
    return () => {
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const nextOffset = offset + 50;
      const q = searchQuery.trim();
      const backendContents = await api.getContents(50, nextOffset, q || undefined);
      if (backendContents.length === 0) {
        setHasMore(false);
      } else {
        const mappedNext = backendContents.map(mapBackendContentToItem);
        setItems((prev) => [...prev, ...mappedNext]);
        setOffset(nextOffset);
        setHasMore(backendContents.length >= 50);
      }
    } catch (err) {
      console.error("Failed to load more feed contents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
    loadBookmarks();
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
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0 h-[57px]">
        {tab === "feed" && isSearching ? (
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search articles, videos, topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full bg-secondary border border-border rounded-xl pl-9 pr-4 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
              <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
            </div>
            <button
              onClick={() => {
                setIsSearching(false);
                setSearchQuery("");
              }}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
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
              <button
                onClick={() => setIsSearching(true)}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-secondary"
              >
                <Search size={18} />
              </button>
            )}
          </>
        )}
      </header>

      {/* Screen content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {tab === "feed" && (
          <FeedScreen
            items={items}
            onOpen={handleOpenReader}
            onSave={toggleSave}
            savedIds={savedIds}
            loading={loading}
            error={feedError}
            onRetry={loadFeed}
            hasMore={hasMore && !searchQuery}
            onLoadMore={loadMore}
          />
        )}
        {tab === "saved" && (
          <SavedScreen
            saved={saved}
            onOpen={handleOpenReader}
            onRemove={async (id) => {
              setSaved((prev) => prev.filter((i) => i.id !== id));
              await api.deleteBookmark(id);
            }}
            error={savedError}
          />
        )}
        {tab === "profile" && (
          <ProfileScreen
            user={user}
            savedCount={saved.length}
            readCount={readIds.size}
            readDates={readDates}
            interests={interests}
            onToggleInterest={handleToggleInterest}
            onLogout={onLogout}
          />
        )}
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
      <Toaster position="top-center" theme="dark" />
      {screen === "auth" && <AuthScreen onAuthSuccess={handleAuthSuccess} />}
      {screen === "app" && <MainApp user={user} onLogout={handleLogout} />}
    </div>
  );
}