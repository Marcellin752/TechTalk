import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { useI18n } from "../lib/i18n";
import type { Keys } from "../locales/en";
import { ArticleCard, CardFor, OpportunityBand, RepoCard } from "../components/ContentCards";
import { buildSections, type SectionKind } from "../lib/feedLayout";
import { ContentItem } from "../types/content";
import type { LearningPath } from "../services/api";
import { ContinueBand } from "../components/ContinueBand";

export type FeedMode = "foryou" | "latest";
export type FeedFilter = "all" | "article" | "video" | "repo" | "opportunity";

interface FeedScreenProps {
  items: ContentItem[];
  onOpen: (item: ContentItem) => void;
  onSave: (item: ContentItem) => void;
  savedIds: Set<string>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  hasMore: boolean;
  onLoadMore: () => void;
  contentType: FeedFilter;
  feedMode: FeedMode;
  onFeedModeChange: (m: FeedMode) => void;
  onFilterChange: (t: FeedFilter) => void;
  searchQuery?: string;
  learningPath?: LearningPath | null;
  learningLoaded?: boolean;
  hasLearningProfile?: boolean;
  onOpenPath?: () => void;
  onStartOnboarding?: () => void;
}

const PULL_THRESHOLD = 72;

const FILTERS: { id: FeedFilter; label: Keys }[] = [
  { id: "all", label: "feed.all" },
  { id: "video", label: "feed.videos" },
  { id: "repo", label: "feed.projects" },
  { id: "article", label: "feed.articles" },
  { id: "opportunity", label: "feed.opportunities" },
];

const SECTION_TITLES: Record<SectionKind, Keys | null> = {
  videos: null,
  opportunity: null,
  repos: "feed.projectsTitle",
  articles: "feed.readTitle",
};

const ROW_GRID: Record<SectionKind, string> = {
  opportunity: "grid-cols-1",
  videos: "grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4",
  repos: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4",
  articles: "grid-cols-1 md:grid-cols-3 gap-6",
};

export function FeedScreen({
  items,
  onOpen,
  onSave,
  savedIds,
  loading,
  error,
  onRetry,
  hasMore,
  onLoadMore,
  contentType,
  feedMode,
  onFeedModeChange,
  onFilterChange,
  searchQuery = "",
  learningPath = null,
  learningLoaded = false,
  hasLearningProfile = false,
  onOpenPath,
  onStartOnboarding,
}: FeedScreenProps) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef<number | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const shouldObserve = !loading && !error && hasMore && items.length > 0;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !shouldObserve) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor) load(cursor, false);
      },
      { rootMargin: "500px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldObserve, load, cursor]);

  const openItem = (item: ContentItem, surface: "feed" | "shorts") => {
    trackInteraction({ contentId: item.id, type: "click", surface });
    markRead(item);
    navigate(`/content/${item.id}`, { state: { item } });
  };

  const shareItem = async (item: ContentItem, surface: "feed" | "shorts") => {
    trackInteraction({ contentId: item.id, type: "share", surface });
    const link = `${window.location.origin}/content/${item.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, url: link });
      } else {
        await navigator.clipboard.writeText(link);
        toast.success("Lien copié dans le presse-papiers !");
      }
    } catch {
      /* partage annulé */
    }
  };

  const skipItem = (item: ContentItem) => {
    trackInteraction({ contentId: item.id, type: "skip", surface: "feed" });
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const refreshing = pullDistance >= PULL_THRESHOLD;
  const flat = contentType !== "all" || !!searchQuery.trim();
  const sections = useMemo(() => (flat ? [] : buildSections(items, !hasMore)), [flat, items, hasMore]);

  return (
    <div className="flex-1 overflow-y-auto" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} ref={scrollRef}>
      <div className="max-w-7xl mx-auto px-4 py-4 pb-8">
        {/* Pull-to-refresh indicator */}
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-200"
          style={{ height: pullDistance }}
        >
          <div
            className={`w-6 h-6 border-2 border-primary/20 rounded-full ${
              refreshing ? "border-t-primary animate-spin" : "border-t-primary"
            }`}
            style={{ transform: `rotate(${pullDistance * 3}deg)` }}
          />
        </div>

        {!searchQuery.trim() && learningLoaded && (
          <ContinueBand path={learningPath} hasProfile={hasLearningProfile} onOpenPath={onOpenPath} onStart={onStartOnboarding} />
        )}

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
          {!searchQuery.trim() && (
            <div role="radiogroup" aria-label="Feed order" className="flex flex-shrink-0 rounded-lg border border-border bg-secondary p-0.5 mr-2">
              {([["foryou", "feed.forYou"], ["latest", "feed.latest"]] as const).map(([id, label]) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={feedMode === id}
                  onClick={() => onFeedModeChange(id)}
                  className={`px-3 h-7 rounded-md text-[13px] font-medium transition-colors ${
                    feedMode === id ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          )}
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => onFilterChange(f.id)}
              className={`px-3.5 h-8 flex-shrink-0 rounded-lg text-[13px] font-medium transition-colors ${
                contentType === f.id
                  ? "bg-foreground text-background"
                  : "bg-secondary text-foreground hover:bg-muted"
              }`}
            >
              {t(f.label)}
            </button>
          ))}
        </div>

        {searchQuery.trim() && !loading && !error && items.length > 0 && (
          <p className="text-xs text-muted-foreground font-mono mb-4">
            {items.length}{hasMore ? "+" : ""} results for “{searchQuery.trim()}”
          </p>
        )}

        {flat ? (
          /* Searching or filtering: one even grid, every card in its own format. */
          <div className={`grid gap-x-4 gap-y-6 ${contentType === "repo" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : contentType === "opportunity" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"}`}>
            {items.map((item) =>
              contentType === "opportunity" ? (
                <OpportunityBand key={item.id} item={item} />
              ) : contentType === "repo" ? (
                <RepoCard key={item.id} item={item} onOpen={() => onOpen(item)} onSave={() => onSave(item)} isSaved={savedIds.has(item.id)} />
              ) : (
                <CardFor key={item.id} item={item} onOpen={() => onOpen(item)} onSave={() => onSave(item)} isSaved={savedIds.has(item.id)} />
              ),
            )}
          </div>
        ) : (
          /* Home: rows that alternate format, like a video site's shelves. */
          <div className="space-y-9">
            {sections.map((section, i) => (
              <section
                key={`${section.kind}-${i}`}
                // Video bands sit on a soft panel; project shelves use outlined cards instead.
                className={section.kind === "videos" ? "rounded-2xl bg-secondary/60 p-3 sm:p-4" : undefined}
              >
                {SECTION_TITLES[section.kind] && (
                  <h2 className="text-[15px] font-semibold text-foreground mb-3.5">{t(SECTION_TITLES[section.kind]!)}</h2>
                )}
                <div className={`grid ${ROW_GRID[section.kind]}`}>
                  {section.items.map((item) =>
                    section.kind === "opportunity" ? (
                      <OpportunityBand key={item.id} item={item} />
                    ) : section.kind === "repos" ? (
                      <RepoCard key={item.id} item={item} onOpen={() => onOpen(item)} onSave={() => onSave(item)} isSaved={savedIds.has(item.id)} />
                    ) : section.kind === "articles" ? (
                      <ArticleCard key={item.id} item={item} onOpen={() => onOpen(item)} onSave={() => onSave(item)} isSaved={savedIds.has(item.id)} />
                    ) : (
                      <CardFor key={item.id} item={item} onOpen={() => onOpen(item)} onSave={() => onSave(item)} isSaved={savedIds.has(item.id)} />
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        {!loading && !error && hasMore && items.length > 0 && (
          <div ref={sentinelRef} className="py-4 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {!loading && !error && items.length === 0 && <EmptyState tab={tab} mode={mode} />}

        {mode === "flux" && (
          <div className="space-y-4 tt-stagger">
            {items.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                isSaved={savedIds.has(item.id)}
                isLiked={likedIds.has(item.id)}
                onOpen={() => openItem(item, "feed")}
                onSave={() => saveItem(item)}
                onLike={() => likeItem(item)}
                onShare={() => shareItem(item, "feed")}
                onSkip={tab === "pour-toi" ? () => skipItem(item) : undefined}
              />
            ))}
          </div>
        )}

        {mode === "videos" && (
          <div className="tt-stagger grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <div key={item.id}>
                <VideoTile item={item} onOpen={() => openItem(item, "feed")} />
                <div className="mt-2.5 flex gap-2.5">
                  <span className="tt-brand-tile mt-0.5 h-8 w-8 flex-shrink-0 rounded-full text-[10px] font-bold">
                    {item.author.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold leading-snug line-clamp-2 cursor-pointer hover:text-primary">
                      {item.title}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>{item.author}</span>
                      <span>·</span>
                      <span>{formatCount(item.views)} vues</span>
                      <span>·</span>
                      <span>{item.date}</span>
                      <SourceBadge source={item.source} />
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {shouldObserve && (
          <div ref={sentinelRef} className="py-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground font-mono tracking-wide">
              {t("common.loading")}
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
              {t("common.retry")}
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm font-mono">
            {t("feed.empty")}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedBar({
  tab,
  mode,
  length,
  onTab,
  onMode,
  onLength,
}: {
  tab: "pour-toi" | "abonnements";
  mode: FeedMode;
  length: LengthFilter;
  onTab: (tab: "pour-toi" | "abonnements") => void;
  onMode: (mode: FeedMode) => void;
  onLength: (length: LengthFilter) => void;
}) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border pb-3">
        <div className="flex items-center gap-5">
          {(["pour-toi", "abonnements"] as const).map((id) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => onTab(id)} className="tt-btn relative px-1 pb-2 text-[15px]">
                <span className={active ? "text-foreground font-bold" : "text-muted-foreground font-medium"}>
                  {id === "pour-toi" && <Sparkles size={13} className="inline -mt-0.5 mr-1 text-muted-foreground" />}
                  {id === "pour-toi" ? "Pour toi" : "Abonnements"}
                </span>
                {active && (
                  <span
                    className="absolute bottom-[-13px] left-0 right-0 h-[3px] rounded-full"
                    style={{ background: "var(--primary)" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1 rounded-full border border-border bg-surface-2 p-1">
          {MODES.map(({ id, label, icon: Icon }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                onClick={() => onMode(id)}
                title={label}
                className={`tt-btn gap-1.5 px-3 py-1.5 text-[12px] ${
                  active ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {mode === "videos" && (
        <div className="mt-4 flex items-center gap-2">
          {(
            [
              { id: "long" as const, label: "Format long" },
              { id: "short" as const, label: "Format court" },
            ]
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onLength(id)}
              className={`tt-chip transition-colors ${
                length === id ? "tt-chip-active font-semibold" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ShortsSkeleton() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="tt-skeleton h-[70vh] w-[min(430px,90vw)] rounded-2xl" />
    </div>
  );
}

function EmptyState({ tab, mode }: { tab: "pour-toi" | "abonnements"; mode: FeedMode }) {
  return (
    <div className="py-16 text-center space-y-4">
      <div className="flex justify-center">
        <span className="tt-glass tt-btn w-14 h-14">
          {tab === "abonnements" ? (
            <Sparkles size={22} className="text-muted-foreground" />
          ) : (
            <Inbox size={22} className="text-muted-foreground" />
          )}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {tab === "abonnements"
          ? "Aucun contenu dans vos centres d'intérêt. Modifiez vos intérêts dans votre profil."
          : mode === "shorts"
            ? "Pas encore de vidéos lisibles en Shorts."
            : "Aucun contenu pour le moment. Revenez plus tard !"}
      </p>
    </div>
  );
}
