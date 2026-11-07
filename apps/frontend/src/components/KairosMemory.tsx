import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { Modal } from "./Modal";
import { useI18n } from "../lib/i18n";

/** What Kairos remembers about you between conversations. You can read all of it and delete any of it. */
export function KairosMemory({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [notes, setNotes] = useState<Array<{ id: string; note: string }> | null>(null);
  useEffect(() => {
    api.kairosMemory().then(setNotes).catch(() => setNotes([]));
  }, []);

  const forget = async (id?: string) => {
    if (!id && !window.confirm(t("kairos.memory.forgetAllConfirm"))) return;
    if (!(await api.kairosForget(id))) return void toast.error(t("admin.error"));
    setNotes((cur) => (id ? (cur ?? []).filter((n) => n.id !== id) : []));
  };

  return (
    <Modal title={t("kairos.memory.title")} onClose={onClose}>
      <div className="px-5 py-4">
        <p className="text-[13px] text-muted-foreground leading-relaxed">{t("kairos.memory.text")}</p>
        {notes === null ? <div className="h-16 rounded-xl bg-secondary animate-pulse mt-4" /> : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("kairos.memory.none")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
            {notes.map((n) => (
              <li key={n.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="flex-1 text-[13.5px] text-foreground">{n.note}</span>
                <button onClick={() => forget(n.id)} aria-label={`${t("cal.delete")}: ${n.note}`} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-between px-5 pb-5">
        {notes && notes.length > 0 ? <button onClick={() => forget()} className="text-[13px] text-muted-foreground hover:text-destructive">{t("kairos.memory.forgetAll")}</button> : <span />}
        <button onClick={onClose} className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold">{t("quiz.close")}</button>
      </div>
    </Modal>
  );
}
