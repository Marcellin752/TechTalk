import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bookmark, ChevronDown, ChevronUp, Compass, ExternalLink, Loader2, Pause, Play, Share2, Sparkles, Star, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { mapBackendContentToItem } from "../lib/content";
import { isShort, KIND_TYPES, kindOf, ReelsQueue, youtubeId, type ReelKind } from "../lib/reels";
import { pathFor, ROUTES } from "../lib/routes";
import { typeLabel } from "../lib/learning";
import { useI18n } from "../lib/i18n";
import { KairosFace } from "../components/KairosArt";
import type { ContentItem } from "../types/content";

interface Props {
  interests: string[];
  onOpen: (item: ContentItem) => void;
  onSave: (item: ContentItem) => void;
  savedIds: Set<string>;
  kairosAvailable?: boolean | null;
}

const MUTE_KEY = "teachtalk_reels_muted";

/** Sends a command to a YouTube iframe that was loaded with enablejsapi=1. */
function ytCommand(frame: HTMLIFrameElement | null, func: string) {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
}

function useReelsFeed(interests: string[]) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ended, setEnded] = useState(false);
  const queue = useRef<ReelsQueue | null>(null);
  const busy = useRef(false);
  const key = interests.join(",");

  const fetchPage = useCallback(
    async (kind: ReelKind, offset: number, limit: number) => {
      // The kinds made of several API types (lessons) are fetched side by side and shuffled by rank.
      const pages = await Promise.all(
        KIND_TYPES[kind].map((type) => api.getContents(Math.ceil(limit / KIND_TYPES[kind].length), Math.floor(offset / KIND_TYPES[kind].length), undefined, type, undefined, { sort: "foryou", interests })),
      );
      const flat: unknown[] = [];
      for (let i = 0; pages.some((p) => i < p.length); i++) for (const p of pages) if (i < p.length) flat.push(p[i]);
      return flat.map(mapBackendContentToItem);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const more = useCallback(async (n = 8) => {
    const q = queue.current;
    if (!q || busy.current) return;
    busy.current = true;
    try {
      const next = await q.next(n);
      setItems((cur) => [...cur, ...next.filter((x) => !cur.some((c) => c.id === x.id))]);
      if (q.exhausted) setEnded(true);
      setError(false);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queue.current = new ReelsQueue(fetchPage);
    setItems([]);
    setEnded(false);
    setLoading(true);
    void more(10);
  }, [fetchPage, more]);

  return { items, loading, error, ended, more };
}

/** The little buttons down the side: save, ask Kairos, open, share, sound. */
function Rail({ item, saved, muted, showSound, onSave, onAsk, onOpen, onShare, onToggleMute, kairos }: {
  item: ContentItem; saved: boolean; muted: boolean; showSound: boolean; kairos: boolean;
  onSave: () => void; onAsk: () => void; onOpen: () => void; onShare: () => void; onToggleMute: () => void;
}) {
  const { t } = useI18n();
  const btn = "flex flex-col items-center gap-1 text-white/90 hover:text-white";
  const circle = "w-11 h-11 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center transition-colors hover:bg-white/25 active:scale-95";
  return (
    <div className="flex flex-col items-center gap-4" role="group" aria-label={item.title}>
      <button onClick={onSave} aria-pressed={saved} aria-label={saved ? t("reels.unsave") : t("reels.save")} className={btn}>
        <span className={`${circle} ${saved ? "!bg-primary text-white" : ""}`}><Bookmark size={20} className={saved ? "fill-white" : ""} /></span>
        <span className="text-[11px]">{saved ? t("reels.saved") : t("reels.save")}</span>
      </button>
      {kairos && (
        <button onClick={onAsk} aria-label={t("reels.askKairos")} className={btn}>
          <span className={`${circle} overflow-hidden`}><KairosFace size={34} ring={false} /></span>
          <span className="text-[11px]">{t("reels.ask")}</span>
        </button>
      )}
      <button onClick={onOpen} aria-label={t("reels.open")} className={btn}>
        <span className={circle}><ExternalLink size={19} /></span>
        <span className="text-[11px]">{t("reels.openShort")}</span>
      </button>
      <button onClick={onShare} aria-label={t("reels.share")} className={btn}>
        <span className={circle}><Share2 size={19} /></span>
        <span className="text-[11px]">{t("reels.share")}</span>
      </button>
      {showSound && (
        <button onClick={onToggleMute} aria-pressed={!muted} aria-label={muted ? t("reels.soundOn") : t("reels.soundOff")} className={btn}>
          <span className={circle}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</span>
          <span className="text-[11px]">{muted ? t("reels.soundOn") : t("reels.soundOff")}</span>
        </button>
      )}
    </div>
  );
}

/** Some sources have nothing to say about an item and put a placeholder: it is not worth showing. */
const hasSummary = (s: string | null | undefined) => !!s && s.trim().length > 12 && !/^(aucune description|no description)/i.test(s.trim());

/** What is said about the item, over the picture: why it is here, the title, a short read. */
function Caption({ item }: { item: ContentItem }) {
  const { t } = useI18n();
  const kind = kindOf(item);
  const label = kind === "video" ? (isShort(item) ? "Short" : t("type.video")) : kind === "article" ? t("reels.article") : typeLabel(t, item.type);
  return (
    <div className="absolute inset-x-0 bottom-0 p-4 pr-16 sm:pr-4 pb-5 bg-gradient-to-t from-black/85 via-black/45 to-transparent text-white pointer-events-none">
      <div className="flex flex-wrap items-center gap-1.5 mb-2 pointer-events-auto">
        <span className="px-2 py-0.5 rounded bg-white/20 backdrop-blur text-[11px] font-semibold uppercase tracking-wide">{label}</span>
        {item.wildcard && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400/90 text-black text-[11px] font-semibold"><Sparkles size={11} /> {t("feed.different")}</span>}
        {item.reason && !item.wildcard && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/90 text-white text-[11px] font-semibold"><Star size={11} /> {item.reason}</span>}
      </div>
      <h2 className="text-[17px] sm:text-[18px] font-bold leading-snug line-clamp-3">{item.title}</h2>
      <p className="text-[12.5px] text-white/75 mt-1">{item.author} · {item.source}</p>
      {hasSummary(item.summary) && <p className="text-[13.5px] text-white/85 mt-2 leading-relaxed line-clamp-3">{item.summary}</p>}
    </div>
  );
}

function Poster({ item }: { item: ContentItem }) {
  return (
    <>
      <img src={item.image} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60" loading="lazy" />
      <div className="absolute inset-0 bg-black/35" />
    </>
  );
}

function VideoReel({ item, active, muted }: { item: ContentItem; active: boolean; muted: boolean }) {
  const { t } = useI18n();
  const id = youtubeId(item.url)!;
  const frame = useRef<HTMLIFrameElement>(null);
  const [paused, setPaused] = useState(false);
  const short = isShort(item);

  useEffect(() => setPaused(false), [active]);
  useEffect(() => ytCommand(frame.current, muted ? "mute" : "unMute"), [muted, active]);

  const toggle = () => {
    ytCommand(frame.current, paused ? "playVideo" : "pauseVideo");
    setPaused((p) => !p);
  };

  const src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${id}&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
  return (
    <>
      <Poster item={item} />
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${short ? "h-full aspect-[9/16] max-w-full" : "w-full aspect-video"} bg-black`}>
        {active ? (
          <iframe ref={frame} title={item.title} src={src} allow="autoplay; encrypted-media; picture-in-picture" className="absolute inset-0 w-full h-full" />
        ) : (
          <img src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        )}
        {/* a tap anywhere on the picture pauses or resumes */}
        <button onClick={toggle} aria-label={paused ? t("reels.play") : t("reels.pause")} className="absolute inset-0 flex items-center justify-center">
          {(paused || !active) && <span className="w-16 h-16 rounded-full bg-black/55 backdrop-blur flex items-center justify-center text-white">{paused || !active ? <Play size={28} className="ml-1 fill-white" /> : <Pause size={28} />}</span>}
        </button>
      </div>
    </>
  );
}

function CardReel({ item }: { item: ContentItem }) {
  const { t } = useI18n();
  const kind = kindOf(item);
  return (
    <>
      <Poster item={item} />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center text-white pb-44">
        {kind === "repo" ? (
          <div className="flex flex-col items-center gap-3">
            <span className="text-5xl" aria-hidden>{"</>"}</span>
            <div className="flex flex-wrap justify-center gap-2 text-[13px]">
              {item.meta?.stars != null && <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur">★ {Intl.NumberFormat("en", { notation: "compact" }).format(item.meta.stars)}</span>}
              {item.meta?.language && <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur">{item.meta.language}</span>}
              {(item.meta?.topics ?? []).slice(0, 3).map((tp) => <span key={tp} className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur">{tp}</span>)}
            </div>
          </div>
        ) : kind === "learn" ? (
          <span className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-[12px] font-semibold uppercase tracking-wide">{t("reels.learnBadge")}</span>
        ) : (
          item.readTime && <span className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-[12px] font-semibold">{t("reels.readTime", { n: parseInt(item.readTime, 10) || 1 })}</span>
        )}
      </div>
    </>
  );
}

/**
 * The vertical feed: one item per screen, swipe up for the next, short videos playing by
 * themselves, with a rail of actions at the side. Always dark: it is meant to be immersive.
 */
export function ReelsScreen({ interests, onOpen, onSave, savedIds, kairosAvailable }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { items, loading, error, ended, more } = useReelsFeed(interests);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const scroller = useRef<HTMLDivElement>(null);
  const refs = useRef<Array<HTMLElement | null>>([]);

  // Which reel fills the screen.
  useEffect(() => {
    const root = scroller.current;
    if (!root || items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.index))),
      { root, threshold: 0.65 },
    );
    refs.current.slice(0, items.length).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [items.length]);

  // Keep a few ahead.
  useEffect(() => {
    if (!ended && items.length > 0 && active >= items.length - 4) void more();
  }, [active, items.length, ended, more]);

  const go = useCallback((delta: number) => {
    const el = refs.current[Math.min(Math.max(active + delta, 0), items.length - 1)];
    el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [active, items.length]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      try {
        localStorage.setItem(MUTE_KEY, m ? "0" : "1");
      } catch {
        /* the choice lasts for this visit */
      }
      return !m;
    });
  }, []);

  const current = items[active];
  const save = () => current && onSave(current);
  const share = useCallback(async (item: ContentItem) => {
    const to = pathFor(item);
    const url = to ? `${window.location.origin}${to}` : item.url;
    try {
      if (navigator.share) await navigator.share({ title: item.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("reels.linkCopied"));
      }
    } catch {
      /* cancelled */
    }
  }, [t]);
  const ask = (item: ContentItem) => navigate(`${ROUTES.kairos}?ask=${encodeURIComponent(t("reels.askPrompt", { title: item.title }))}`);

  // Keyboard: arrows or j/k to move, m for sound, s to save.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowDown" || e.key === "j") (e.preventDefault(), go(1));
      else if (e.key === "ArrowUp" || e.key === "k") (e.preventDefault(), go(-1));
      else if (e.key === "m") toggleMute();
      else if (e.key === "s") save();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, toggleMute, current?.id]);

  const body = useMemo(() => items, [items]);

  if (loading && body.length === 0) {
    return (
      <div className="flex-1 bg-black flex items-center justify-center" role="status" aria-label={t("common.loading")}>
        <Loader2 className="animate-spin text-white/70" size={30} />
      </div>
    );
  }
  if (body.length === 0) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center gap-3 text-center text-white px-6">
        <p className="text-lg font-semibold">{error ? t("reels.error") : t("reels.empty")}</p>
        <button onClick={() => void more(10)} className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold">{t("common.retry")}</button>
        <Link to={ROUTES.explore} className="text-sm text-white/70 underline">{t("reels.explore")}</Link>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0 bg-black overflow-hidden" data-testid="reels">
      <div
        ref={scroller}
        tabIndex={0}
        role="feed"
        aria-label={t("reels.label")}
        aria-busy={loading}
        className="h-full overflow-y-auto snap-y snap-mandatory overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:outline-none"
      >
        {body.map((item, i) => {
          const near = Math.abs(i - active) <= 1;
          const kind = kindOf(item);
          return (
            <article
              key={item.id}
              ref={(el) => void (refs.current[i] = el)}
              data-index={i}
              aria-posinset={i + 1}
              aria-setsize={-1}
              className="relative h-full w-full snap-start snap-always flex justify-center"
            >
              <div className="relative h-full w-full sm:max-w-[460px] overflow-hidden sm:rounded-2xl sm:ring-1 sm:ring-white/15 bg-neutral-900">
                {near ? (kind === "video" ? <VideoReel item={item} active={i === active} muted={muted} /> : <CardReel item={item} />) : <Poster item={item} />}
                <Caption item={item} />
                {/* on phones the rail sits over the picture */}
                <div className="sm:hidden absolute right-2.5 bottom-24 z-10">
                  <Rail item={item} saved={savedIds.has(item.id)} muted={muted} showSound={kind === "video"} kairos={!!kairosAvailable} onSave={() => onSave(item)} onAsk={() => ask(item)} onOpen={() => onOpen(item)} onShare={() => share(item)} onToggleMute={toggleMute} />
                </div>
              </div>
              {/* on computers it sits beside the card */}
              <div className="hidden sm:flex absolute bottom-6 left-1/2 ml-[240px] z-10">
                <Rail item={item} saved={savedIds.has(item.id)} muted={muted} showSound={kind === "video"} kairos={!!kairosAvailable} onSave={() => onSave(item)} onAsk={() => ask(item)} onOpen={() => onOpen(item)} onShare={() => share(item)} onToggleMute={toggleMute} />
              </div>
            </article>
          );
        })}
        {loading && body.length > 0 && <div className="h-16 flex items-center justify-center snap-start"><Loader2 className="animate-spin text-white/60" /></div>}
        {ended && (
          <div className="h-full snap-start flex flex-col items-center justify-center gap-3 text-center text-white px-6">
            <p className="text-lg font-semibold">{t("reels.end")}</p>
            <Link to={ROUTES.explore} className="px-5 h-10 inline-flex items-center rounded-xl bg-primary text-white text-sm font-semibold">{t("reels.explore")}</Link>
          </div>
        )}
      </div>

      {/* Explore, and up/down on computers */}
      <Link to={ROUTES.explore} className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-black/45 backdrop-blur text-white text-[13px] font-medium hover:bg-black/60">
        <Compass size={15} /> {t("nav.explore")}
      </Link>
      <div className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 flex-col gap-3">
        <button onClick={() => go(-1)} disabled={active === 0} aria-label={t("reels.prev")} className="w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white hover:bg-white/25 disabled:opacity-30"><ChevronUp size={22} /></button>
        <button onClick={() => go(1)} disabled={active >= body.length - 1 && ended} aria-label={t("reels.next")} className="w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-white hover:bg-white/25 disabled:opacity-30"><ChevronDown size={22} /></button>
      </div>
    </div>
  );
}
