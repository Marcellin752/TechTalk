import { useState, useEffect, useRef } from "react";
import { Rss, Search, Bookmark, User, Settings, X } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useTheme } from "../lib/theme";
import { mapBackendContentToItem } from "../lib/content";
import { ThemeToggle } from "../components/ThemeToggle";
import { api, User as ApiUser } from "../services/api";
import { ContentItem, AppScreen, AppTab } from "../types/content";
import { AuthScreen } from "../pages/AuthScreen";
import { FeedScreen, type FeedFilter } from "../pages/FeedScreen";
import { SavedScreen } from "../pages/SavedScreen";
import { ProfileScreen } from "../pages/ProfileScreen";
import { SettingsScreen } from "../pages/SettingsScreen";
import { AboutScreen } from "../pages/AboutScreen";
import { ReaderScreen } from "../pages/ReaderScreen";

/** Items fetched per format and page; two cycles of the feed rhythm. */
const MIXED_PAGE = { video: 32, repo: 6, article: 6, opportunity: 3 } as const;

function MainApp({ user, onUserUpdate, onLogout }: { user: ApiUser | null; onUserUpdate: (u: ApiUser) => void; onLogout: () => void }) {
  const [tab, setTab] = useState<AppTab>(() => (/^#link(_error)?=/.test(window.location.hash) ? "profile" : "feed"));
  const [reader, setReader] = useState<ContentItem | null>(null);
  const [saved, setSaved] = useState<ContentItem[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [contentType, setContentType] = useState<FeedFilter>("all");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

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
    api.markContentRead(item.id);
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

  const typeParam = contentType === "all" ? undefined : contentType;
  const interestParam = interests.length > 0 ? interests : undefined;

  // The home feed is built from three separate streams so no format can crowd
  // the others out (new repositories would otherwise fill every page).
  const mixedOffsets = useRef({ video: 0, repo: 0, article: 0, opportunity: 0 });
  const fetchMixed = async () => {
    const o = mixedOffsets.current;
    const types = ["video", "repo", "article", "opportunity"] as const;
    // Opportunities are not filtered by interest chips: they are few and always welcome.
    const [videos, repos, articles, opportunities] = await Promise.all(
      types.map((t) => api.getContents(MIXED_PAGE[t], o[t], undefined, t, t === "opportunity" ? undefined : interestParam)),
    );
    o.video += videos.length;
    o.repo += repos.length;
    o.article += articles.length;
    o.opportunity += opportunities.length;
    return {
      items: [...videos, ...repos, ...articles, ...opportunities].map(mapBackendContentToItem),
      more: videos.length === MIXED_PAGE.video || repos.length === MIXED_PAGE.repo || articles.length === MIXED_PAGE.article,
    };
  };

  const loadFeed = async () => {
    setLoading(true);
    setFeedError(null);
    try {
      if (contentType === "all") {
        mixedOffsets.current = { video: 0, repo: 0, article: 0, opportunity: 0 };
        const mixed = await fetchMixed();
        setItems(mixed.items);
        setOffset(0);
        setHasMore(mixed.more);
        return;
      }
      const backendContents = await api.getContents(50, 0, undefined, typeParam, interestParam);
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

  const searchDebounceRef = useRef<number | null>(null);

  const searchSeq = useRef(0);

  const runSearch = async (term: string) => {
    const trimmed = term.trim();
    const seq = ++searchSeq.current;
    setLoading(true);
    setFeedError(null);
    try {
      if (!trimmed) {
        await loadFeed();
        return;
      }
      // Searching looks at everything, not just the interest chips; and a slower,
      // older request must never overwrite a newer one.
      const results = await api.getContents(50, 0, trimmed, typeParam);
      if (seq !== searchSeq.current) return;
      setItems(results.map(mapBackendContentToItem));
      setOffset(0);
      setHasMore(results.length >= 50);
    } catch (err) {
      console.error("Failed to search feed:", err);
      if (seq === searchSeq.current) setFeedError("Search failed. Check your connection and try again.");
    } finally {
      if (seq === searchSeq.current) setLoading(false);
    }
  };

  const prevSearchRef = useRef("");

  // The GitHub link round trip lands back here with the outcome in the fragment.
  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const linked = params.get("link");
    const linkError = params.get("link_error");
    if (!linked && !linkError) return;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    if (linked) toast.success("GitHub account linked.");
    else if (linkError === "taken") toast.error("That GitHub account is already linked to another TechTalk account.");
    else toast.error("GitHub linking failed. Please try again.");
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q && !prevSearchRef.current) {
      prevSearchRef.current = "";
      return;
    }
    prevSearchRef.current = q;
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
    }
    if (!q) {
      runSearch("");
      return;
    }
    searchDebounceRef.current = window.setTimeout(() => runSearch(q), 250);
    return () => {
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      if (contentType === "all" && !searchQuery.trim()) {
        const mixed = await fetchMixed();
        setItems((prev) => [...prev, ...mixed.items.filter((m) => !prev.some((p) => p.id === m.id))]);
        setHasMore(mixed.more);
        return;
      }
      const nextOffset = offset + 50;
      const q = searchQuery.trim();
      const backendContents = await api.getContents(50, nextOffset, q || undefined, typeParam, q ? undefined : interestParam);
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
    if (searchQuery.trim()) return;
    loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, interests.join(",")]);

  useEffect(() => {
    loadBookmarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.getServerReading().then((server) => {
      if (cancelled || !server) return;
      const localIdsRaw = localStorage.getItem("teachtalk_read_ids");
      const localIds = localIdsRaw ? JSON.parse(localIdsRaw) : [];
      const localDatesRaw = localStorage.getItem("teachtalk_read_dates");
      const localDates = localDatesRaw && Array.isArray(JSON.parse(localDatesRaw)) ? JSON.parse(localDatesRaw) : [];

      const serverIds = new Set(server.readIds);
      const mergedIds = Array.from(new Set([...localIds, ...server.readIds]));
      const mergedDates = Array.from(new Set([...localDates, ...server.readDates]));

      localStorage.setItem("teachtalk_read_ids", JSON.stringify(mergedIds));
      localStorage.setItem("teachtalk_read_dates", JSON.stringify(mergedDates));
      setReadIds(new Set(mergedIds));
      setReadDates(mergedDates);

      const localOnlyIds = localIds.filter((id: string) => !serverIds.has(id));
      if (localOnlyIds.length > 0) {
        api.syncReadingBatch(localOnlyIds);
      }
    });
    return () => { cancelled = true; };
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

  const headerTitle: Record<AppTab, string> = {
    feed: "TechTalk",
    saved: "Saved",
    profile: "Profile",
    settings: "Settings",
    about: "About",
  };

  return (
    <div className="h-dvh bg-background flex flex-col max-w-screen overflow-hidden">
      {/* Header */}
      <header className="z-40 bg-background/90 backdrop-blur-md border-b border-border flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 h-[57px] flex items-center justify-between">
        {tab === "feed" ? (
          <div className="flex items-center gap-3 w-full">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/30">
                <Rss size={13} className="text-white" />
              </div>
              <span className="hidden sm:block text-[18px] font-bold tracking-tight text-foreground">TechTalk</span>
            </div>
            {/* Live search: results update as you type (name, keyword, language, topic). */}
            <div className="relative flex-1 max-w-2xl mx-auto">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                inputMode="search"
                placeholder="Search a name, a keyword, a language…"
                aria-label="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setSearchQuery("")}
                className="w-full h-10 bg-secondary border border-border rounded-full pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors [&::-webkit-search-cancel-button]:hidden"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <ThemeToggle />
              <button
                onClick={() => setTab("saved")}
                className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Saved"
              >
                <Bookmark size={18} />
              </button>
              <button
                onClick={() => setTab("settings")}
                className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Settings"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={() => setTab("profile")}
                className="p-1 rounded-full hover:bg-secondary transition-colors"
                aria-label="Profile"
              >
                {user?.picture ? (
                  <img src={user.picture} alt={user.name || "Profile"} className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                    <User size={14} className="text-primary" />
                  </div>
                )}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-[18px] font-bold text-foreground">{headerTitle[tab]}</h1>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              {tab !== "saved" && (
                <button
                  onClick={() => setTab("saved")}
                  className={`p-2 rounded-xl hover:bg-secondary transition-colors ${
                    tab === "saved" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label="Saved"
                >
                  <Bookmark size={18} />
                </button>
              )}
              <button
                onClick={() => setTab("settings")}
                className={`p-2 rounded-xl hover:bg-secondary transition-colors ${
                  tab === "settings" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Settings"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={() => setTab("profile")}
                className={`p-1 rounded-full hover:bg-secondary transition-colors ${
                  tab === "profile" ? "ring-2 ring-primary/40" : ""
                }`}
                aria-label="Profile"
              >
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt={user.name || "Profile"}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                    <User size={14} className="text-primary" />
                  </div>
                )}
              </button>
            </div>
          </>
        )}
        </div>
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
            contentType={contentType}
            onFilterChange={setContentType}
            searchQuery={searchQuery}
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
            onBack={() => setTab("feed")}
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
            onNavigateToSaved={() => setTab("saved")}
            onNavigateToAbout={() => setTab("about")}
            onLogout={onLogout}
            onBack={() => setTab("feed")}
          />
        )}
        {tab === "settings" && (
          <SettingsScreen
            user={user}
            interests={interests}
            onToggleInterest={handleToggleInterest}
            onUserUpdate={onUserUpdate}
            onBack={() => setTab("feed")}
            onNavigateToAbout={() => setTab("about")}
          />
        )}
        {tab === "about" && <AboutScreen onBack={() => setTab("feed")} />}
      </div>

      {/* Reader overlay */}
      {reader && (
        <ReaderScreen
          item={reader}
          onBack={() => setReader(null)}
          onSave={() => toggleSave(reader)}
          isSaved={savedIds.has(reader.id)}
          onOpenItem={handleOpenReader}
        />
      )}
    </div>
  );
}


export default function App() {
  const theme = useTheme();
  const [screen, setScreen] = useState<AppScreen>(() => {
    return api.getToken() ? "app" : "auth";
  });
  const [user, setUser] = useState<ApiUser | null>(() => {
    return api.getUser();
  });
  const [bootstrapping, setBootstrapping] = useState(() => !!api.getToken());

  useEffect(() => {
    if (!api.getToken()) {
      setBootstrapping(false);
      return;
    }
    api.getMe().then((res) => {
      if (res.success && res.user) {
        setUser(res.user);
        api.scheduleTokenRefresh();
      } else {
        api.logout();
        setUser(null);
        setScreen("auth");
      }
      setBootstrapping(false);
    });
  }, []);

  const handleAuthSuccess = (authUser: ApiUser) => {
    setUser(authUser);
    api.scheduleTokenRefresh();
    setScreen("app");
  };

  const handleUserUpdate = (updatedUser: ApiUser) => {
    setUser(updatedUser);
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setScreen("auth");
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" theme={theme} />
      {bootstrapping ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {screen === "auth" && <AuthScreen onAuthSuccess={handleAuthSuccess} />}
          {screen === "app" && <MainApp user={user} onUserUpdate={handleUserUpdate} onLogout={handleLogout} />}
        </>
      )}
    </div>
  );
}