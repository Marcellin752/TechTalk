import { useEffect } from "react";
import { X } from "lucide-react";
import { useI18n } from "../lib/i18n";

/** A dialog: centred on computers, a bottom sheet on phones. Escape and the backdrop close it. */
export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:px-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`bg-card border border-border sm:rounded-2xl rounded-t-2xl w-full ${wide ? "max-w-xl" : "max-w-md"} max-h-[92dvh] overflow-y-auto shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} aria-label={t("common.cancel")} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
