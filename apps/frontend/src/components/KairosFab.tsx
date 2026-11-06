import { useEffect, useState } from "react";
import { Expand, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { KairosAvatar, KairosChat } from "./KairosChat";
import { KairosFace } from "./KairosArt";
import { ROUTES } from "../lib/routes";
import { useI18n } from "../lib/i18n";

/* The floating Kairos button, like a messaging app's: a gently floating orb with
   a pulsing ring and an occasional wiggle, a speech bubble that greets once per
   session, and a compact chat that opens above it. Motion is switched off for
   people who ask their system for reduced motion. */

const GREETED = "teachtalk_kairos_greeted";

export function KairosFab() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [bubble, setBubble] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);

  // One greeting per session, a few seconds after arriving, then it tucks itself away.
  useEffect(() => {
    let greeted = false;
    try {
      greeted = sessionStorage.getItem(GREETED) === "1";
    } catch {
      /* treated as not greeted */
    }
    if (greeted) return;
    const show = window.setTimeout(() => setBubble(true), 4000);
    const hide = window.setTimeout(() => setBubble(false), 13000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);

  const dismissBubble = () => {
    setBubble(false);
    try {
      sessionStorage.setItem(GREETED, "1");
    } catch {
      /* ignore */
    }
  };

  const toggle = () => {
    dismissBubble();
    setOpen((v) => !v);
  };

  const newChat = () => {
    setConversationId(null);
    setChatKey((k) => k + 1);
  };

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label={t("kairos.fabLabel")}
          className="kairos-pop fixed z-40 inset-x-0 top-0 bottom-[3.75rem] lg:inset-x-auto lg:right-6 lg:bottom-24 lg:top-4 lg:w-[min(760px,calc(100vw-3rem))] flex flex-col lg:rounded-2xl border border-border bg-card shadow-2xl shadow-black/30 overflow-hidden"
        >
          <header className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
            <KairosAvatar size={32} />
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-semibold text-foreground leading-tight">Kairos</h2>
              <p className="text-[11.5px] text-muted-foreground leading-tight flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {t("kairos.mentor")}
              </p>
            </div>
            <button onClick={newChat} aria-label={t("kairos.new")} title={t("kairos.new")} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary">
              <Plus size={17} />
            </button>
            <button
              onClick={() => {
                setOpen(false);
                navigate(ROUTES.kairos + (conversationId ? `?c=${conversationId}` : ""));
              }}
              aria-label={t("kairos.fullPage")}
              title={t("kairos.fullPage")}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <Expand size={16} />
            </button>
            <button onClick={() => setOpen(false)} aria-label={t("kairos.close")} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary">
              <X size={17} />
            </button>
          </header>
          <div className="flex-1 min-h-0">
            <KairosChat key={chatKey} conversationId={conversationId} onConversation={(id) => setConversationId(id)} />
          </div>
        </section>
      )}

      <div className={`fixed z-40 right-4 bottom-20 lg:right-6 lg:bottom-6 items-end gap-3 pointer-events-none ${open ? "hidden lg:flex" : "flex"}`}>
        {bubble && !open && (
          <button
            onClick={toggle}
            className="kairos-pop pointer-events-auto relative mb-1 max-w-[220px] text-left rounded-2xl rounded-br-sm bg-card border border-border shadow-lg px-3.5 py-2.5 text-[13px] text-foreground"
          >
            <span className="font-semibold">{t("kairos.bubbleTitle")}</span>
            <span className="block text-muted-foreground text-[12px] mt-0.5">{t("kairos.bubbleText")}</span>
            <span
              role="button"
              aria-label="Dismiss"
              onClick={(e) => {
                e.stopPropagation();
                dismissBubble();
              }}
              className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-secondary border border-border text-muted-foreground flex items-center justify-center hover:text-foreground"
            >
              <X size={11} />
            </span>
          </button>
        )}

        <button
          onClick={toggle}
          aria-label={open ? t("kairos.close") : t("kairos.fabLabel")}
          aria-expanded={open}
          className="pointer-events-auto relative w-14 h-14 rounded-full kairos-float focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {!open && <span aria-hidden className="absolute inset-0 rounded-full bg-primary/40 kairos-ping" />}
          <span className="relative block w-full h-full rounded-full shadow-xl shadow-primary/40 kairos-wiggle">
            <span className="absolute inset-0 rounded-full flex items-center justify-center bg-gradient-to-br from-[#f04f23] via-[#ff7a30] to-[#ffb347] text-white transition-transform hover:scale-105 active:scale-95">
              {open ? <X size={24} /> : <span className="absolute inset-[3px] flex items-center justify-center"><KairosFace size={50} ring={false} /></span>}
            </span>
          </span>
          {!open && <span aria-hidden className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-background" />}
        </button>
      </div>
    </>
  );
}
