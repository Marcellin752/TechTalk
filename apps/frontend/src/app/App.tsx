import { useState, useEffect, useRef } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Menu, Rss, Search, User, Settings, X } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useTheme } from "../lib/theme";
import { mapBackendContentToItem } from "../lib/content";
import { ThemeToggle } from "../components/ThemeToggle";
import { api, LearningPath, LearningProfile, User as ApiUser } from "../services/api";
import { ContentItem, AppTab } from "../types/content";
import { pathFor, ROUTES, TAB_PATHS, tabFor } from "../lib/routes";
import { AuthScreen } from "../pages/AuthScreen";
import { FeedScreen, type FeedFilter, type FeedMode } from "../pages/FeedScreen";
import { SavedScreen } from "../pages/SavedScreen";
import { ProfileScreen } from "../pages/ProfileScreen";
import { SettingsScreen } from "../pages/SettingsScreen";
import { LearnScreen } from "../pages/LearnScreen";
import { PathScreen } from "../pages/PathScreen";
import { OnboardingScreen } from "../pages/OnboardingScreen";
import { KairosScreen } from "../pages/KairosScreen";
import { KairosFab } from "../components/KairosFab";
import { PeopleScreen } from "../pages/PeopleScreen";
import { PublicProfileScreen } from "../pages/PublicProfileScreen";
import { LandingScreen } from "../pages/LandingScreen";
import { PublicShell } from "../components/PublicShell";
import { useI18n } from "../lib/i18n";
import { useSeo } from "../lib/seo";
import { PracticeScreen } from "../pages/PracticeScreen";
import { BottomBar, SideMenu } from "../components/NavMenu";
import { AboutScreen } from "../pages/AboutScreen";
import { ReaderScreen } from "../pages/ReaderScreen";

/** Items fetched per format and page; two cycles of the feed rhythm. */
const MIXED_PAGE = { video: 32, repo: 6, article: 6, opportunity: 3 } as const;

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function NotFound({ message }: { message?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
      <div className="text-5xl font-bold text-foreground">404</div>
      <p className="text-sm text-muted-foreground">{message ?? t("common.notFound")}</p>
      <Link to={ROUTES.home} className="mt-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold">
        {t("common.backToFeed")}
      </Link>
    </div>
  );
}

/** Goes back in history when there is a previous page of ours, otherwise to the feed. */
function useGoBack() {
  const navigate = useNavigate();
  return () => (typeof window.history.state?.idx === "number" && window.history.state.idx > 0 ? navigate(-1) : navigate(ROUTES.home, { replace: true }));
}

/** One content page. Resolves the item from navigation state, the feed in memory,
 *  or the API, so a link opened cold (shared, reloaded) works too. */
function ContentRoute({
  items,
  saved,
  savedIds,
  onSave,
  onSeen,
  onOpenItem,
}: {
  items: ContentItem[];
  saved: ContentItem[];
  savedIds: Set<string>;
  onSave: (item: ContentItem) => void;
  onSeen: (item: ContentItem) => void;
  onOpenItem: (item: ContentItem) => void;
}) {
  const { id = "" } = useParams();
  const location = useLocation();
  const goBack = useGoBack();
  const fromState = (location.state as { item?: ContentItem } | null)?.item;
  const known = (fromState?.id === id ? fromState : null) ?? items.find((i) => i.id === id) ?? saved.find((i) => i.id === id) ?? null;
  const [item, setItem] = useState<ContentItem | null>(known);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setMissing(false);
    if (known) {
      setItem(known);
      return;
    }
    let cancelled = false;
    setItem(null);
    api
      .getContent(id)
      .then((c) => !cancelled && setItem(mapBackendContentToItem(c)))
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (item) onSeen(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (missing) return <NotFound message="This content doesn't exist or was removed." />;
  if (!item) return <Spinner />;
  const to = pathFor(item);
  if (!to) return <Navigate to={ROUTES.home} replace />;
  // A video opened at /article/... (or the reverse) is sent to its proper address.
  if (to !== location.pathname) return <Navigate to={to} replace state={{ item }} />;

  return <ReaderScreen item={item} onBack={goBack} onSave={() => onSave(item)} isSaved={savedIds.has(item.id)} onOpenItem={onOpenItem} />;
}

function MainApp({ user, onUserUpdate, onLogout }: { user: ApiUser | null; onUserUpdate: (u: ApiUser) => void; onLogout: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = tabFor(location.pathname);
  const goTab = (t: AppTab) => navigate(TAB_PATHS[t]);
  const [menuCollapsed, setMenuCollapsed] = useState(() => {
    try {
      return localStorage.getItem("teachtalk_menu_collapsed") === "1";
    } catch {
      return false;
    }
  });
  const toggleMenu = () =>
    setMenuCollapsed((v) => {
      try {
        localStorage.setItem("teachtalk_menu_collapsed", v ? "0" : "1");
      } catch {
        /* not remembered */
      }
      return !v;
    });
  const [saved, setSaved] = useState<ContentItem[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  
  // Search text and the format filter live in the address (?q=…&type=…) so a feed view can be shared.
  const [searchQuery, setSearchQuery] = useState(() => params.get("q") ?? "");
  const [contentType, setContentType] = useState<FeedFilter>(() => {
    const t = params.get("type");
    return t === "video" || t === "repo" || t === "article" || t === "opportunity" ? t : "all";
  });
  const [feedMode, setFeedModeState] = useState<FeedMode>(() => {
    try {
      return localStorage.getItem("teachtalk_feed_mode") === "latest" ? "latest" : "foryou";
    } catch {
      return "foryou";
    }
  });
  const setFeedMode = (m: FeedMode) => {
    setFeedModeState(m);
    try {
      localStorage.setItem("teachtalk_feed_mode", m);
    } catch {
      /* the choice just will not be remembered */
    }
  };
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

  /** Records that an item was opened (local streak and the server's history). */
  const markRead = (item: ContentItem) => {
    setReadIds((prev) => {
      if (prev.has(item.id)) return prev;
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

  /** Open an item on its own page; the item rides along so the page paints instantly. */
  const handleOpenReader = (item: ContentItem) => {
    const to = pathFor(item);
    if (!to) {
      window.open(item.url, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(to, { state: { item } });
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
      void api.saveProfileSettings({ interests: next }); // so a public profile can show them
      return next;
    });
  };

  useEffect(() => {
    if (location.pathname !== ROUTES.home) return;
    const next = new URLSearchParams();
    if (searchQuery.trim()) next.set("q", searchQuery.trim());
    if (contentType !== "all") next.set("type", contentType);
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, contentType, location.pathname]);

  // The learner's profile and path: loaded once; a newcomer is sent to the questions first.
  const [learning, setLearning] = useState<{ loaded: boolean; profile: LearningProfile | null; path: LearningPath | null }>({ loaded: false, profile: null, path: null });
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getLearningProfile(), api.getLearningPath()])
      .then(([profile, path]) => {
        if (cancelled) return;
        setLearning({ loaded: true, profile, path });
        let skipped = false;
        try {
          skipped = localStorage.getItem("teachtalk_onboarding_skipped") === "1";
        } catch {
          /* treated as not skipped */
        }
        if (!profile && !skipped) navigate(ROUTES.onboarding, { replace: true });
      })
      .catch(() => !cancelled && setLearning((l) => ({ ...l, loaded: true })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the server's copy of the learner's topics current (a public profile can show them).
  useEffect(() => {
    void api.saveProfileSettings({ interests });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kairos is offered only when the server has a language model to power it.
  const [kairosAvailable, setKairosAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    api.kairosStatus().then((s) => setKairosAvailable(s.available));
  }, []);

  const savedIds = new Set(saved.map((i) => i.id));

  const typeParam = contentType === "all" ? undefined : contentType;
  const interestParam = interests.length > 0 ? interests : undefined;
  // "For you": interests become a ranking signal (not a filter) and the server orders the page.
  const forYou = feedMode === "foryou";
  const rankOpts = forYou ? ({ sort: "foryou", interests } as const) : undefined;
  const filterParam = forYou ? undefined : interestParam;

  // The home feed is built from three separate streams so no format can crowd
  // the others out (new repositories would otherwise fill every page).
  const mixedOffsets = useRef({ video: 0, repo: 0, article: 0, opportunity: 0 });
  const fetchMixed = async () => {
    const o = mixedOffsets.current;
    const types = ["video", "repo", "article", "opportunity"] as const;
    // Opportunities are not filtered by interest chips: they are few and always welcome.
    const [videos, repos, articles, opportunities] = await Promise.all(
      types.map((t) => api.getContents(MIXED_PAGE[t], o[t], undefined, t, t === "opportunity" ? undefined : filterParam, rankOpts)),
    );
    o.video += videos.length;
    o.repo += repos.length;
    o.article += articles.length;
    o.opportunity += opportunities.length;
    // A few picks from outside the learner's domains: fresh on every page, placed by the layout.
    const [wildVideos, wildRepos, wildArticles] = await Promise.all(
      (["video", "repo", "article"] as const).map((t) =>
        api.getContents(t === "video" ? 3 : 1, 0, undefined, t, undefined, { sort: "wildcard", interests }).catch(() => []),
      ),
    );
    return {
      items: [...videos, ...repos, ...articles, ...opportunities, ...wildVideos, ...wildRepos, ...wildArticles].map(mapBackendContentToItem),
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
      const backendContents = await api.getContents(50, 0, undefined, typeParam, filterParam, rankOpts);
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
      const backendContents = await api.getContents(50, nextOffset, q || undefined, typeParam, q ? undefined : filterParam, q ? undefined : rankOpts);
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
  }, [contentType, interests.join(","), feedMode]);

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

  const { t, lang } = useI18n();
  const headerTitle: Record<AppTab, string> = {
    feed: "TechTalk",
    learn: t("nav.learn"),
    path: t("nav.path"),
    kairos: "Kairos",
    practice: t("nav.practice"),
    people: t("nav.people"),
    saved: t("nav.saved"),
    profile: t("nav.profile"),
    settings: t("nav.settings"),
    about: t("nav.about"),
  };
  // Signed-in pages are private: keep them out of search results. Public pages set their own metadata.
  const publicPath = location.pathname.startsWith("/people") || location.pathname.startsWith("/u/");
  useSeo(publicPath ? null : { title: headerTitle[tab], noindex: true, path: location.pathname }, lang);

function BootSpinner() {
  return (
    <div className="h-dvh bg-background flex flex-col max-w-screen overflow-hidden">
      {/* Header */}
      <header className="z-40 bg-background/90 backdrop-blur-md border-b border-border flex-shrink-0">
        <div className="px-4 h-[57px] flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMenu}
            aria-label={menuCollapsed ? t("header.menuExpand") : t("header.menuCollapse")}
            className="hidden lg:flex w-10 h-10 -ml-2 rounded-full items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0 flex items-center justify-between">
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
                placeholder={t("header.search")}
                aria-label={t("header.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setSearchQuery("")}
                className="w-full h-10 bg-secondary border border-border rounded-full pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors [&::-webkit-search-cancel-button]:hidden"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  aria-label={t("common.clear")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <ThemeToggle />
              <button
                onClick={() => goTab("settings")}
                className="lg:hidden p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Settings"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={() => goTab("profile")}
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
              <button
                onClick={() => goTab("settings")}
                className={`p-2 rounded-xl hover:bg-secondary transition-colors ${
                  tab === "settings" ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Settings"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={() => goTab("profile")}
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
        </div>
      </header>

      {/* Menu + screen content */}
      <div className="flex-1 flex min-h-0">
        <SideMenu collapsed={menuCollapsed} />
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Routes>
          <Route
            path={ROUTES.home}
            element={
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
                feedMode={feedMode}
                onFeedModeChange={setFeedMode}
                onFilterChange={setContentType}
                searchQuery={searchQuery}
                learningPath={learning.path}
                learningLoaded={learning.loaded}
                hasLearningProfile={!!learning.profile}
                onOpenPath={() => goTab("path")}
                onStartOnboarding={() => navigate(ROUTES.onboarding)}
              />
            }
          />
          <Route path={ROUTES.learn} element={<LearnScreen onOpen={handleOpenReader} />} />
          <Route path={ROUTES.practice} element={<PracticeScreen />} />
          <Route path={ROUTES.kairos} element={<KairosScreen available={kairosAvailable} />} />
          <Route path={ROUTES.people} element={<PeopleScreen />} />
          <Route path="/u/:handle" element={<PublicProfileScreen />} />
          <Route path={ROUTES.path} element={<PathScreen path={learning.path} loaded={learning.loaded} onPath={(path) => setLearning((l) => ({ ...l, path }))} />} />
          <Route
            path={ROUTES.saved}
            element={
              <SavedScreen
                saved={saved}
                onOpen={handleOpenReader}
                onRemove={async (id) => {
                  setSaved((prev) => prev.filter((i) => i.id !== id));
                  await api.deleteBookmark(id);
                }}
                onBack={() => goTab("feed")}
                error={savedError}
              />
            }
          />
          <Route
            path={ROUTES.profile}
            element={
              <ProfileScreen
                user={user}
                savedCount={saved.length}
                readCount={readIds.size}
                readDates={readDates}
                interests={interests}
                onToggleInterest={handleToggleInterest}
                onNavigateToSaved={() => goTab("saved")}
                onNavigateToAbout={() => goTab("about")}
                onLogout={onLogout}
                onBack={() => goTab("feed")}
                onUserUpdate={onUserUpdate}
                learningPath={learning.path}
                learningLoaded={learning.loaded}
                onOpenPath={() => goTab("path")}
                onStartOnboarding={() => navigate(ROUTES.onboarding)}
              />
            }
          />
          <Route
            path={ROUTES.settings}
            element={
              <SettingsScreen
                user={user}
                interests={interests}
                onToggleInterest={handleToggleInterest}
                feedMode={feedMode}
                onFeedModeChange={setFeedMode}
                onUserUpdate={onUserUpdate}
                onLogout={onLogout}
              />
            }
          />
          <Route path={ROUTES.about} element={<AboutScreen onBack={() => goTab("feed")} />} />
          {(["/watch/:id", "/project/:id", "/article/:id"] as const).map((path) => (
            <Route
              key={path}
              path={path}
              element={<ContentRoute items={items} saved={saved} savedIds={savedIds} onSave={toggleSave} onSeen={markRead} onOpenItem={handleOpenReader} />}
            />
          ))}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </div>
      </div>
      {kairosAvailable && tab !== "kairos" && <KairosFab />}
      <BottomBar />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactElement }) {
  if (!api.getToken()) return <Navigate to="/login" replace />;
  return children;
}

/* Campus pages were written before routing; they expect an onBack callback. */
function useGoBack() {
  const navigate = useNavigate();
  return () => navigate("/feed");
}

const CampusRoute = () => <CampusScreen onBack={useGoBack()} />;
const AnnalsRoute = () => <AnnalsScreen onBack={useGoBack()} />;
const CampusLifeRoute = () => <CampusLifeScreen onBack={useGoBack()} />;
const AboutRoute = () => <AboutScreen onBack={useGoBack()} />;

/** Pages anyone can open without signing in: the landing page, the directory and public profiles. */
function PublicGate() {
  const location = useLocation();
  return (
    <Routes>
      <Route path="/" element={<LandingScreen />} />
      <Route path="/people" element={<PublicShell><PeopleScreen /></PublicShell>} />
      <Route path="/u/:handle" element={<PublicShell><PublicProfileScreen /></PublicShell>} />
      <Route path="*" element={<Navigate to={ROUTES.login} replace state={{ from: location }} />} />
    </Routes>
  );
}

function RequireAuth({ authed, children }: { authed: boolean; children: React.ReactElement }) {
  const location = useLocation();
  if (!authed) return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  return children;
}

/** Already signed in: leave the login page for where the user was heading. */
function LeaveLogin() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from;
  return <Navigate to={from ? `${from.pathname}${from.search ?? ""}` : ROUTES.home} replace />;
}

export default function App() {
  const theme = useTheme();
  const [user, setUser] = useState<ApiUser | null>(() => api.getUser());
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
      }
      setBootstrapping(false);
    });
  }, []);

  const handleAuthSuccess = (authUser: ApiUser) => {
    setUser(authUser);
    api.scheduleTokenRefresh();
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
  };

  const authed = !!user && !!api.getToken();

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" theme={theme} />
      {bootstrapping ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <Routes>
          <Route path={ROUTES.login} element={authed ? <LeaveLogin /> : <AuthScreen onAuthSuccess={handleAuthSuccess} />} />
          <Route
            path={ROUTES.onboarding}
            element={
              <RequireAuth authed={authed}>
                <OnboardingScreen />
              </RequireAuth>
            }
          />
          <Route
            path="/*"
            element={authed ? <MainApp user={user} onUserUpdate={setUser} onLogout={handleLogout} /> : <PublicGate />}
          />
        </Routes>
      )}
    </div>
  );
}
