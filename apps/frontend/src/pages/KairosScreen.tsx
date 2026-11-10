import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Brain, History } from "lucide-react";
import { toast } from "sonner";
import { api, KairosConversation } from "../services/api";
import { KairosAvatar, KairosChat } from "../components/KairosChat";
import { KairosHistory } from "../components/KairosHistory";
import { KairosMemory } from "../components/KairosMemory";
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
  const [memory, setMemory] = useState(false);
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

  const rename = async (id: string, title: string) => {
    const ok = await api.kairosRename(id, title);
    if (!ok) return toast.error(t("admin.error")), false;
    setList((l) => (l ?? []).map((c) => (c.id === id ? { ...c, title } : c)));
    return true;
  };

  const sidebar = (
    <KairosHistory
      list={list}
      activeId={conversationId}
      onOpen={(id) => open(id)}
      onNew={() => open(null)}
      onRename={rename}
      onDelete={(id) => remove(id)}
      onClearAll={clearAll}
    />
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
          <button onClick={() => setMemory(true)} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary" title={t("kairos.memory.title")}>
            <Brain size={15} /> <span className="hidden sm:inline">{t("kairos.memory.title")}</span>
          </button>
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
      {memory && <KairosMemory onClose={() => setMemory(false)} />}
    </div>
  );
}
