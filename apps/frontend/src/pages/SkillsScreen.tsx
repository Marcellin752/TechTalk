import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, EyeOff, Loader2, Network, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { api, SkillDetail, SkillEvaluation, SkillLevel, SkillsOverview } from "../services/api";
import { ROUTES } from "../lib/routes";
import { askKairos } from "../lib/askKairos";
import { SkillGraph } from "../components/SkillGraph";
import { useI18n } from "../lib/i18n";

const LEVELS: SkillLevel[] = ["applied", "understood", "learning", "exploring"];
const TONE: Record<SkillLevel, string> = {
  applied: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  understood: "bg-primary/15 text-primary",
  learning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  exploring: "bg-secondary text-muted-foreground",
  unseen: "bg-secondary text-muted-foreground",
};

function LevelChip({ level }: { level: SkillLevel }) {
  const { t } = useI18n();
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${TONE[level]}`}>{t(`skills.level.${level}`)}</span>;
}

/** What the learner knows, and how we know. Consulting a resource is not understanding; only quizzes, reviews, exercises and explanations raise a level. */
export function SkillsScreen() {
  const { slug } = useParams();
  // The graph takes all the width there is; the detail of one concept stays a readable column.
  return <div className="flex-1 overflow-y-auto"><div className={slug ? "max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-16" : "w-full px-3 sm:px-6 py-6 pb-12"}>{slug ? <Detail slug={slug} /> : <Overview />}</div></div>;
}

function Overview() {
  const { t } = useI18n();
  const [data, setData] = useState<SkillsOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const nav = useNavigate();
  useEffect(() => {
    api.getSkills().then((r) => (r.data ? setData(r.data) : setFailed(true)));
  }, []);
  const forgetAll = async () => {
    if (!window.confirm(t("skills.forgetAllConfirm"))) return;
    await api.forgetSkills();
    setData(null);
    api.getSkills().then((r) => r.data && setData(r.data));
  };
  return (
    <>
      <div className="text-center mb-5">
        <span className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto"><Network size={24} /></span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-3">{t("skills.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">{t("skills.subtitle")}</p>
      </div>
      {!data && !failed && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>}
      {failed && <p className="text-center text-sm text-muted-foreground">{t("admin.error")}</p>}
      {data && data.nodes.filter((n) => n.level !== "unseen").length === 0 && <p className="max-w-xl mx-auto mb-4 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">{t("skills.empty")}</p>}
      {data && data.nodes.length > 0 && <SkillGraph nodes={data.nodes} edges={data.edges} ready={data.ready} onOpen={(slug) => nav(`${ROUTES.skills}/${slug}`)} />}
      {data && data.nodes.length > 0 && <button onClick={forgetAll} className="mt-6 text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground">{t("skills.forgetAll")}</button>}
    </>
  );
}

function Detail({ slug }: { slug: string }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const [d, setD] = useState<SkillDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [contesting, setContesting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    api.getSkill(slug).then((r) => (r.data ? setD(r.data) : setMissing(true)));
  }, [slug]);
  useEffect(() => { setD(null); setMissing(false); setText(""); load(); }, [load]);

  const explain = async () => {
    setBusy(true);
    const r = await api.explainSkill(slug, text);
    setBusy(false);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    setText("");
    load();
  };
  const contest = async (id: string) => {
    setBusy(true);
    const r = await api.contestEvaluation(id, reason);
    setBusy(false);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    setContesting(null);
    setReason("");
    load();
  };
  const hide = async (edgeId: string, hidden: boolean) => {
    await api.hideSkillEdge(edgeId, hidden);
    load();
  };
  const forget = async () => {
    if (!window.confirm(t("skills.forgetConfirm"))) return;
    await api.forgetSkills(slug);
    load();
  };

  if (missing) return <p className="text-center text-sm text-muted-foreground py-12">{t("skills.notFound")}</p>;
  if (!d) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>;

  const links = (title: string, list: SkillDetail["prerequisites"]) => list.length === 0 ? null : (
    <section>
      <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h2>
      <ul className="space-y-1.5">
        {list.map((l) => (
          <li key={l.edgeId} className={`flex items-center gap-2 text-sm ${l.hidden ? "opacity-50" : ""}`}>
            <Link to={`${ROUTES.skills}/${l.slug}`} className="font-medium text-foreground hover:underline">{l.name}</Link>
            <LevelChip level={l.level} />
            <button onClick={() => hide(l.edgeId, !l.hidden)} title={l.hidden ? t("skills.showLink") : t("skills.hideLink")} className="ml-auto p-1 text-muted-foreground hover:text-foreground"><EyeOff size={14} /></button>
          </li>
        ))}
      </ul>
    </section>
  );

  const verdict = (ev: SkillEvaluation) => (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      {ev.text && <p className="text-[13px] text-muted-foreground italic line-clamp-3">“{ev.text}”</p>}
      <ul className="space-y-1">
        {ev.criteria.map((c) => (
          <li key={c.id} className="flex gap-2 text-[13px]">
            {c.met ? <Check size={15} className="text-emerald-600 mt-0.5 shrink-0" /> : <X size={15} className="text-muted-foreground mt-0.5 shrink-0" />}
            <span><span className="font-medium text-foreground">{c.label}</span>{c.comment ? <span className="text-muted-foreground"> — {c.comment}</span> : null}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-foreground">{ev.feedback}</p>
      {ev.revised ? <p className="text-[12px] text-muted-foreground">{t("skills.reviewed")}</p> : contesting === ev.id ? (
        <div className="space-y-2">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={400} rows={2} placeholder={t("skills.contestPlaceholder")} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button disabled={busy || reason.trim().length < 8} onClick={() => contest(ev.id)} className="px-3 h-8 rounded-lg bg-primary text-white text-[13px] font-semibold disabled:opacity-50">{t("skills.contestSend")}</button>
            <button onClick={() => setContesting(null)} className="px-3 h-8 rounded-lg text-[13px] text-muted-foreground">{t("common.cancel")}</button>
          </div>
        </div>
      ) : <button onClick={() => { setContesting(ev.id); setReason(""); }} className="text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground">{t("skills.contest")}</button>}
    </div>
  );

  return (
    <div className="space-y-6">
      <button onClick={() => nav(ROUTES.skills)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> {t("skills.title")}</button>
      <header>
        <div className="flex items-center gap-3 flex-wrap"><h1 className="text-2xl font-bold tracking-tight text-foreground">{d.name}</h1><LevelChip level={d.level} /></div>
        {d.description && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{d.description}</p>}
        <div className="flex flex-wrap gap-2 mt-3">
          <Link to={askKairos(t("ask.skill", { name: d.name }))} className="px-3 h-8 inline-flex items-center rounded-lg bg-primary/10 text-primary text-[13px] font-semibold">{t("ask.kairos")}</Link>
          <Link to={`${ROUTES.memory}?front=${encodeURIComponent(d.name)}&topic=${encodeURIComponent(d.slug)}`} className="px-3 h-8 inline-flex items-center rounded-lg border border-border text-[13px] font-medium text-foreground hover:bg-secondary">{t("skills.makeCard")}</Link>
          <Link to={`${ROUTES.lab}?new=${encodeURIComponent(d.name)}&topic=${encodeURIComponent(d.slug)}`} className="px-3 h-8 inline-flex items-center rounded-lg border border-border text-[13px] font-medium text-foreground hover:bg-secondary">{t("skills.startProject")}</Link>
        </div>
      </header>

      <section>
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("skills.why")}</h2>
        {d.reasons.length ? <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">{d.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul> : <p className="text-sm text-muted-foreground">{t("skills.noEvidence")}</p>}
        {d.evidence.length > 0 && <button onClick={forget} className="mt-2 text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground">{t("skills.forget")}</button>}
      </section>

      {d.missing.length > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="text-sm font-semibold text-foreground">{t("skills.missing")}</h2>
          <div className="flex flex-wrap gap-2 mt-2">{d.missing.map((m) => <Link key={m.slug} to={`${ROUTES.skills}/${m.slug}`} className="px-3 py-1 rounded-lg bg-secondary text-[13px] font-medium text-foreground">{m.name}</Link>)}</div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{t("skills.explainTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("skills.explainHelp")}</p>
        <ul className="text-[13px] text-muted-foreground list-disc pl-5">{d.criteria.map((c) => <li key={c.id}>{c.label}</li>)}</ul>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} rows={5} placeholder={t("skills.explainPlaceholder")} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <button disabled={busy || text.trim().length < 40} onClick={explain} className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} {t("skills.explainSend")}
        </button>
        {d.evaluations.map((ev) => <div key={ev.id}>{verdict(ev)}</div>)}
      </section>

      {links(t("skills.prereq"), d.prerequisites)}
      {links(t("skills.unlocks"), d.unlocks)}

      {d.resources.length > 0 && (
        <section>
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("skills.resources")}</h2>
          <ul className="space-y-1.5">{d.resources.map((r) => <li key={r.id}><a href={r.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">{r.title}</a> <span className="text-[12px] text-muted-foreground">{r.source}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}
