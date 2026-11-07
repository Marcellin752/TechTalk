import { useCallback, useEffect, useState } from "react";
import { Layers, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useI18n } from "../lib/i18n";
import { btnCls, ghostCls, inputCls, Page, PageHeader, Section } from "../components/PageHeader";

interface Card { id: string; front: string; back: string; topic: string | null; dueAt: string; intervalDays: number; reps: number; lapses: number }

/** Your own flashcards, scheduled so each one comes back just before you would forget it. */
export function MemoryScreen() {
  const { t } = useI18n();
  const [due, setDue] = useState<Card[] | null>(null);
  const [all, setAll] = useState<Card[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [topic, setTopic] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api.growth<{ due: Card[]; all: Card[] }>("/cards?all=1");
    setDue(r.data?.due ?? []);
    setAll(r.data?.all ?? []);
    setRevealed(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true);
    const payload = { front, back, topic: topic || null };
    const r = editing ? await api.growth(`/cards/${editing}`, "PATCH", payload) : await api.growth("/cards", "POST", payload);
    setBusy(false);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    setFront(""); setBack(""); setTopic(""); setEditing(null);
    load();
  };
  const grade = async (c: Card, g: 0 | 1 | 2 | 3) => {
    const r = await api.growth(`/cards/${c.id}/grade`, "POST", { grade: g });
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    load();
  };
  const remove = async (id: string) => {
    if (!window.confirm(t("memory.deleteConfirm"))) return;
    await api.growth(`/cards/${id}`, "DELETE");
    load();
  };
  const current = due?.[0];

  return (
    <Page>
      <PageHeader icon={Layers} title={t("memory.title")} subtitle={t("memory.subtitle")} />
      {due === null && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>}

      {due && (
        <Section title={`${t("memory.due")} · ${due.length}`}>
          {!current ? (
            <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{all.length === 0 ? t("memory.empty") : t("memory.allDone")}</p>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <p className="text-lg font-semibold text-foreground whitespace-pre-wrap">{current.front}</p>
              {revealed ? (
                <>
                  <p className="text-sm text-foreground whitespace-pre-wrap border-t border-border pt-4">{current.back}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {([[0, "memory.again"], [1, "memory.hard"], [2, "memory.good"], [3, "memory.easy"]] as const).map(([g, k]) => (
                      <button key={g} onClick={() => grade(current, g)} className={ghostCls}>{t(k)}</button>
                    ))}
                  </div>
                </>
              ) : <button onClick={() => setRevealed(true)} className={btnCls}>{t("memory.show")}</button>}
            </div>
          )}
        </Section>
      )}

      <Section title={editing ? t("memory.edit") : t("memory.new")}>
        <div className="space-y-2">
          <input value={front} onChange={(e) => setFront(e.target.value)} maxLength={400} placeholder={t("memory.front")} className={inputCls} />
          <textarea value={back} onChange={(e) => setBack(e.target.value)} maxLength={2000} rows={3} placeholder={t("memory.back")} className={inputCls} />
          <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={60} placeholder={t("memory.topic")} className={inputCls} />
          <p className="text-[12px] text-muted-foreground">{t("memory.topicHelp")}</p>
          <div className="flex gap-2">
            <button disabled={busy || front.trim().length < 2 || !back.trim()} onClick={save} className={btnCls}><Plus size={15} /> {editing ? t("common.save") : t("memory.add")}</button>
            {editing && <button onClick={() => { setEditing(null); setFront(""); setBack(""); setTopic(""); }} className={ghostCls}>{t("common.cancel")}</button>}
          </div>
        </div>
      </Section>

      {all.length > 0 && (
        <Section title={`${t("memory.all")} · ${all.length}`}>
          <ul className="space-y-2">
            {all.map((c) => (
              <li key={c.id} className="rounded-xl border border-border bg-card px-4 py-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{c.front}</p>
                  <p className="text-[12px] text-muted-foreground">{c.topic ? `${c.topic} · ` : ""}{t("memory.interval", { n: c.intervalDays })}</p>
                </div>
                <button aria-label={t("memory.edit")} onClick={() => { setEditing(c.id); setFront(c.front); setBack(c.back); setTopic(c.topic ?? ""); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil size={15} /></button>
                <button aria-label={t("common.delete")} onClick={() => remove(c.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}
