import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Copy, ExternalLink, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { api, KairosAction, KairosMessage } from "../services/api";
import { ROUTES } from "../lib/routes";
import { Markdown } from "./Markdown";
import { useI18n } from "../lib/i18n";
import { KairosFace, KairosPortrait } from "./KairosArt";

/** The face of Kairos, drawn: see KairosArt. */
export function KairosAvatar({ size = 28 }: { size?: number }) {
  return <KairosFace size={size} />;
}

interface Props {
  /** The conversation to show, or null for a fresh one. */
  conversationId: string | null;
  /** Called when a new conversation is created by the first message. */
  onConversation: (id: string, title?: string) => void;
  compact?: boolean;
}

/** One conversation: its messages, the box to write in, and the call to Kairos. */
export function KairosChat({ conversationId, onConversation, compact = false }: Props) {
  const { t, lang } = useI18n();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  /** What Kairos proposes after its latest answer, and what it noted to remember. The learner decides. */
  const [actions, setActions] = useState<KairosAction[]>([]);
  const [remembered, setRemembered] = useState<string[]>([]);
  const suggestions = [t("kairos.s1"), t("kairos.s2"), t("kairos.s3"), t("kairos.s4")];
  const [messages, setMessages] = useState<KairosMessage[]>([]);
  // Arriving with ?ask=… (from a card in the feed) puts the question in the box, ready to send.
  const [draft, setDraft] = useState(() => (conversationId ? "" : (new URLSearchParams(window.location.search).get("ask") ?? "").slice(0, 1500)));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  /** Follow-up questions Kairos proposed for its latest answer. */
  const [followUps, setFollowUps] = useState<string[]>([]);
  const idRef = useRef<string | null>(conversationId);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Opening another conversation loads it; a new one starts empty.
  useEffect(() => {
    if (conversationId === idRef.current && messages.length > 0) return;
    idRef.current = conversationId;
    setError(null);
    if (!conversationId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    api
      .kairosConversation(conversationId)
      .then((c) => !cancelled && setMessages(c.messages))
      .catch(() => !cancelled && setError("Could not load this conversation."))
      .finally(() => !cancelled && setLoadingHistory(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || sending) return;
      setError(null);
      setFollowUps([]);
      setActions([]);
      setRemembered([]);
      setDraft("");
      setSending(true);
      const optimistic: KairosMessage = { id: `local-${Date.now()}`, role: "user", content: message, createdAt: new Date().toISOString() };
      setMessages((m) => [...m, optimistic]);
      const res = await api.kairosChat(message, idRef.current ?? undefined, lang, pathname);
      setSending(false);
      if (!res.success || !res.message) {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setDraft(message); // nothing is lost: the text goes back to the box
        setError(res.error || "Kairos could not answer.");
        return;
      }
      if (res.conversationId && res.conversationId !== idRef.current) {
        idRef.current = res.conversationId;
        onConversation(res.conversationId, res.title);
      }
      setMessages((m) => [...m, res.message!]);
      setFollowUps(res.suggestions ?? []);
      setActions(res.actions ?? []);
      setRemembered(res.remembered ?? []);
      inputRef.current?.focus();
    },
    [sending, onConversation, lang, pathname],
  );

  const rate = async (m: KairosMessage, value: 1 | -1) => {
    const next = m.feedback === value ? 0 : value;
    setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, feedback: next === 0 ? null : next } : x)));
    if (!(await api.kairosFeedback(m.id, next))) {
      setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, feedback: m.feedback ?? null } : x)));
      toast.error(t("kairos.rateFailed"));
    }
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("kairos.copied"));
    } catch {
      toast.error(t("kairos.rateFailed"));
    }
  };
  const labelOf = (a: KairosAction): string => {
    switch (a.type) {
      case "calendar.add": return `${a.title} · ${new Date(a.startsAt).toLocaleString(lang === "fr" ? "fr-FR" : "en-US", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
      case "plan.sessions": return t("kairos.act.plan");
      case "path.rebuild": return t("kairos.act.rebuild");
      case "review.open": return t("kairos.act.review");
      case "card.add": return a.front;
      case "project.add": return a.title;
      case "research.add": return `${a.workspace} · ${a.title}`;
      case "skill.open": return a.slug.replace(/-/g, " ");
      case "page.open": return t(`nav.${a.page}` as "nav.today");
    }
  };
  const VERB: Record<KairosAction["type"], "kairos.act.addCal" | "kairos.act.planGo" | "kairos.act.rebuildGo" | "kairos.act.reviewGo" | "kairos.act.cardGo" | "kairos.act.projectGo" | "kairos.act.researchGo" | "kairos.act.skillGo" | "kairos.act.pageGo"> = {
    "calendar.add": "kairos.act.addCal", "plan.sessions": "kairos.act.planGo", "path.rebuild": "kairos.act.rebuildGo", "review.open": "kairos.act.reviewGo",
    "card.add": "kairos.act.cardGo", "project.add": "kairos.act.projectGo", "research.add": "kairos.act.researchGo", "skill.open": "kairos.act.skillGo", "page.open": "kairos.act.pageGo",
  };
  const verbOf = (a: KairosAction): string => t(VERB[a.type]);
  /** The learner pressed a button: only now does anything change, through the app's own checked endpoints. */
  const perform = async (a: KairosAction) => {
    setActions((cur) => cur.filter((x) => x !== a));
    const done = (r: { success: boolean; error?: string }, ok: string) => (r.success ? toast.success(ok) : toast.error(r.error || t("kairos.rateFailed")));
    switch (a.type) {
      case "review.open": return navigate("/review");
      case "skill.open": return navigate(`${ROUTES.skills}/${a.slug}`);
      case "page.open": return navigate(ROUTES[a.page]);
      case "calendar.add": return done(await api.createEvent({ title: a.title, kind: a.kind, startsAt: a.startsAt, endsAt: a.endsAt, notes: a.notes ?? null }), t("cal.saved"));
      case "plan.sessions": {
        const r = await api.planCalendar({ startHour: 18, days: [1, 2, 3, 4, 5], weeks: 4 });
        return r.success ? toast.success(r.planned > 0 ? t("cal.planned", { n: r.planned }) : t("cal.planNone")) : toast.error(r.error || t("kairos.rateFailed"));
      }
      case "path.rebuild": return done(await api.regenerateLearningPath(), t("path.rebuilt"));
      case "card.add": return done(await api.growth("/cards", "POST", { front: a.front, back: a.back, topic: a.topic }), t("kairos.done.card"));
      case "project.add": return done(await api.growth("/projects", "POST", { title: a.title, description: a.description, topics: a.topics }), t("kairos.done.project"));
      case "research.add": return done(await api.growth("/research", "POST", { workspace: a.workspace, kind: "note", title: a.title, note: a.note }), t("kairos.done.research"));
    }
  };
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div className="relative flex flex-col h-full min-h-0">
      {/* The god, faint behind the conversation */}
      <KairosPortrait className="absolute right-[-6%] bottom-12 w-[62%] max-w-[420px] opacity-[0.10] dark:opacity-[0.16]" />
      <div className={`relative flex-1 overflow-y-auto ${compact ? "px-3.5 py-3" : "px-[max(1rem,calc((100%_-_48rem)/2))] py-5"} space-y-4`} aria-live="polite">
        {loadingHistory ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-secondary animate-pulse" />)}</div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-3">
            <KairosPortrait className={compact ? "w-28" : "w-40"} />
            <h2 className="text-[17px] font-semibold text-foreground mt-3">{t("kairos.hi")}</h2>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-xs">{t("kairos.intro")}</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/50 hover:bg-primary/5 text-[12.5px] text-foreground transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-white px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-wrap break-words">{m.content}</div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-2.5">
                <KairosAvatar size={26} />
                <div className="min-w-0 max-w-[92%]">
                  <div className="rounded-2xl rounded-tl-md bg-secondary px-3.5 py-2.5">
                    <Markdown text={m.content} sources={m.sources} />
                  </div>
                  {m.sources && m.sources.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {m.sources.map((s) => (
                        <li key={s.id}>
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-border bg-card hover:border-primary/50 px-2.5 py-1.5 text-[12.5px] transition-colors">
                            <span className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">{s.n}</span>
                            <span className="min-w-0 flex-1 truncate text-foreground">{s.title}</span>
                            <span className="text-muted-foreground flex-shrink-0 hidden sm:inline">{s.source}</span>
                            <ExternalLink size={12} className="text-muted-foreground flex-shrink-0" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!m.id.startsWith("local-") && (
                    <div className="mt-1.5 flex items-center gap-0.5 text-muted-foreground">
                      <button onClick={() => rate(m, 1)} aria-pressed={m.feedback === 1} aria-label={t("kairos.helpful")} title={t("kairos.helpful")} className={`w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary hover:text-foreground ${m.feedback === 1 ? "text-primary" : ""}`}><ThumbsUp size={14} /></button>
                      <button onClick={() => rate(m, -1)} aria-pressed={m.feedback === -1} aria-label={t("kairos.notHelpful")} title={t("kairos.notHelpful")} className={`w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary hover:text-foreground ${m.feedback === -1 ? "text-destructive" : ""}`}><ThumbsDown size={14} /></button>
                      <button onClick={() => copy(m.content)} aria-label={t("kairos.copy")} title={t("kairos.copy")} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-secondary hover:text-foreground"><Copy size={14} /></button>
                    </div>
                  )}
                  {m.id === lastAssistantId && actions.length > 0 && !sending && (
                    <div className="mt-2.5 flex flex-col gap-1.5">
                      {actions.map((a, k) => (
                        <div key={k} className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2">
                          <span className="flex-1 min-w-0 text-[13px] text-foreground truncate">{labelOf(a)}</span>
                          <button onClick={() => perform(a)} className="px-3 h-8 rounded-lg bg-primary text-white text-[12.5px] font-semibold flex-shrink-0">{verbOf(a)}</button>
                          <button onClick={() => setActions((cur) => cur.filter((x) => x !== a))} aria-label={t("common.cancel")} className="w-7 h-7 rounded-md text-muted-foreground hover:text-foreground flex-shrink-0">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {m.id === lastAssistantId && remembered.length > 0 && !sending && (
                    <p className="mt-2 text-[12px] text-muted-foreground">{t("kairos.noted", { note: remembered[0]! })}</p>
                  )}
                  {m.id === lastAssistantId && followUps.length > 0 && !sending && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {followUps.map((f) => (
                        <button key={f} onClick={() => send(f)} className="px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/50 hover:bg-primary/5 text-[12.5px] text-foreground text-left transition-colors">{f}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          )
        )}

        {sending && (
          <div className="flex gap-2.5 items-center" aria-label={t("kairos.typing")}>
            <KairosAvatar size={26} />
            <div className="rounded-2xl rounded-tl-md bg-secondary px-3.5 py-3 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground kairos-dot" style={{ animationDelay: `${i * 0.18}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div role="alert" className="mx-3 mb-2 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-[12.5px] px-3 py-2">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className={`relative border-t border-border bg-background/80 backdrop-blur-sm ${compact ? "p-2.5" : "px-[max(1rem,calc((100%_-_48rem)/2))] py-3"} flex items-end gap-2`}
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 1500))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
          rows={1}
          placeholder={t("kairos.placeholder")}
          aria-label={t("kairos.placeholder")}
          className="flex-1 resize-none max-h-32 rounded-xl bg-secondary border border-border px-3.5 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <button type="submit" disabled={!draft.trim() || sending} aria-label="Send" className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity">
          <ArrowUp size={18} />
        </button>
      </form>
    </div>
  );
}
