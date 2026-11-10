import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useI18n } from "../lib/i18n";

/** Link a Codewars account: katas you have solved tick the matching steps of your paths. It is a convenience, not a proof of identity, and the page says so. */
export function CodewarsLink() {
  const { t } = useI18n();
  const [linked, setLinked] = useState<string | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getLearningProfile().then((p) => setLinked(p?.codewarsUsername ?? null)).catch(() => setLinked(null));
  }, []);

  if (linked === undefined) return <div className="h-14 rounded-xl bg-secondary animate-pulse" />;

  const link = async () => {
    setBusy(true);
    const r = await api.linkCodewars(name.trim());
    setBusy(false);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    setLinked(name.trim());
    toast.success(t("codewars.linked"));
  };
  const sync = async () => {
    setBusy(true);
    const r = await api.syncCodewars();
    setBusy(false);
    if (!r.success || !r.data) return void toast.error(r.error || t("admin.error"));
    toast.success(r.data.newlyDone > 0 ? t("codewars.ticked", { n: r.data.newlyDone }) : t("codewars.nothingNew", { n: r.data.solved }));
  };
  const unlink = async () => {
    await api.unlinkCodewars();
    setLinked(null);
    setName("");
  };

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground leading-relaxed">{t("codewars.text")}</p>
      {linked ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-foreground">{t("codewars.as")} <strong className="font-mono">{linked}</strong></span>
          <button onClick={sync} disabled={busy} className="inline-flex items-center gap-2 px-3.5 h-9 rounded-lg bg-primary text-white text-[13px] font-semibold disabled:opacity-60"><RefreshCw size={14} className={busy ? "animate-spin" : ""} /> {t("codewars.sync")}</button>
          <button onClick={unlink} className="text-[13px] text-muted-foreground hover:text-destructive">{t("codewars.unlink")}</button>
        </div>
      ) : (
        <div className="flex gap-2 max-w-sm">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim().length >= 2 && link()} placeholder={t("codewars.placeholder")} aria-label={t("codewars.placeholder")} maxLength={40} className="flex-1 min-w-0 h-10 rounded-xl bg-secondary border border-border px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
          <button onClick={link} disabled={busy || name.trim().length < 2} className="px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50">{t("codewars.link")}</button>
        </div>
      )}
      <p className="text-[12px] text-muted-foreground">{t("codewars.caveat")}</p>
    </div>
  );
}
