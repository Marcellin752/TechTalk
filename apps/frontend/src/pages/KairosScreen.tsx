import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { History, MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, KairosConversation } from "../services/api";
import { KairosAvatar, KairosChat } from "../components/KairosChat";
import { KairosPortrait } from "../components/KairosArt";
import { dateLocale, useI18n, type Lang, type T } from "../lib/i18n";

function ago(iso: string, t: T, lang: Lang): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d < 1) return t("profile.today");
  if (d === 1) return t("profile.yesterday");
  return new Date(iso).toLocaleDateString(dateLocale(lang), { month: "short", day: "numeric" });
}

/** Kairos on a full page: the conversation, and the history of past ones beside it. */
export function KairosScreen({ available }: { available: boolean | null }) {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const conversationId = params.get("c");
  const [list, setList] = useState<KairosConversation[] | null>(null);
  const [showList, setShowList] = useState(false);
  const [chatKey, setChatKey] = useState(0);

  const refresh = useCallback(() => {
    api.kairosConversations().then(setList).catch(() => setList([]));
  }, []);
  useEffect(refresh, [refresh]);

  const open = (id: string | null) => {
    setParams(id ? { c: id } : {}, { replace: true });
    setChatKey((k) => k + 1);
    setShowList(false);
  };

  const remove = async (id: string) => {
    if (!(await api.kairosDelete(id))) return void toast.error("Could not delete this conversation.");
    setList((l) => (l ?? []).filter((c) => c.id !== id));
    if (id === conversationId) open(null);
  };

  const clearAll = async () => {
    if (!window.confirm(t("kairos.deleteAllConfirm"))) return;
    if (!(await api.kairosDelete())) return void toast.error("Could not delete your conversations.");
    setList([]);
    open(null);
  };

  if (available === false) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
        <KairosPortrait className="w-40" />
        <h1 className="text-xl font-bold text-foreground">{t("kairos.unavailable")}</h1>
        <p className="text-sm text-muted-foreground max-w-sm">{t("kairos.unavailableText")}</p>
      </div>
    );
  }

  const sidebar = (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 flex items-center gap-2">
        <button onClick={() => open(null)} className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-white text-sm font-semibold shadow-md shadow-primary/25">
          <MessageSquarePlus size={16} /> {t("kairos.new")}
        </button>
      </div>
      <div className="px-3 pb-1 text-[11px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{t("kairos.history")}</div>
      <ul className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {list === null && [0, 1, 2].map((i) => <li key={i} className="h-11 rounded-lg bg-secondary animate-pulse m-1" />)}
        {list?.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-muted-foreground">{t("kairos.noChats")}</li>}
        {list?.map((c) => (
          <li key={c.id} className="group relative">
            <button onClick={() => open(c.id)} className={`w-full text-left rounded-lg px-3 py-2 pr-9 transition-colors ${c.id === conversationId ? "bg-secondary" : "hover:bg-secondary/60"}`}>
              <span className="block text-[13.5px] text-foreground truncate">{c.title}</span>
              <span className="block text-[11px] text-muted-foreground">{ago(c.updatedAt, t, lang)}</span>
            </button>
            <button onClick={() => remove(c.id)} aria-label={`Delete "${c.title}"`} className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-destructive hover:bg-background">
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      {list && list.length > 0 && (
        <button onClick={clearAll} className="m-3 mt-0 text-[12px] text-muted-foreground hover:text-destructive text-left">
          {t("kairos.deleteAll")}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex">
      <aside className="hidden md:block w-72 flex-shrink-0 border-r border-border">{sidebar}</aside>
      {showList && (
        <div className="md:hidden fixed inset-0 top-[57px] z-30 bg-background" onClick={() => setShowList(false)}>
          <div onClick={(e) => e.stopPropagation()} className="h-full">{sidebar}</div>
        </div>
      )}
      <section className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center gap-3 px-4 sm:px-6 h-14 border-b border-border flex-shrink-0">
          <KairosAvatar size={32} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-semibold text-foreground leading-tight">Kairos</h1>
            <p className="text-[12px] text-muted-foreground leading-tight">{t("kairos.knows")}</p>
          </div>
          <button onClick={() => setShowList(true)} className="md:hidden inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border text-sm text-foreground">
            <History size={15} /> {t("kairos.history")}
          </button>
        </header>
        <div className="flex-1 min-h-0 w-full">
          <KairosChat
            key={chatKey}
            conversationId={conversationId}
            onConversation={(id) => {
              setParams({ c: id }, { replace: true });
              refresh();
            }}
          />
        </div>
      </section>
    </div>
  );
}
