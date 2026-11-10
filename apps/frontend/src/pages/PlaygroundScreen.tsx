import { useEffect, useState } from "react";
import { Check, Loader2, Play, Terminal, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "../services/api";
import { useI18n } from "../lib/i18n";
import { runExercise, TestCase, TestResult } from "../lib/runExercise";
import { btnCls, inputCls, Page, PageHeader } from "../components/PageHeader";

interface Exercise { id: string; concept: string; title: string; level: string; prompt: string; fn: string; starter: string; tests: TestCase[] }

/** Small JavaScript exercises that run in your browser. Passing counts as a (light) proof of the concept. */
export function PlaygroundScreen() {
  const { t } = useI18n();
  const [list, setList] = useState<Exercise[] | null>(null);
  const [cur, setCur] = useState<Exercise | null>(null);
  const [code, setCode] = useState("");
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => { api.growth<{ exercises: Exercise[] }>("/exercises").then((r) => setList(r.data?.exercises ?? [])); }, []);
  const open = (e: Exercise) => { setCur(e); setCode(e.starter); setResults(null); setError(null); };

  const run = async () => {
    if (!cur) return;
    setRunning(true); setError(null);
    const r = await runExercise(code, cur.fn, cur.tests);
    setRunning(false);
    if ("error" in r) { setResults(null); return void setError(r.error === "timeout" ? t("play.timeout") : r.error); }
    setResults(r.results);
    if (r.results.every((x) => x.ok)) {
      const s = await api.growth(`/exercises/${cur.id}/passed`, "POST", { passed: true });
      if (s.success) toast.success(t("play.passed"));
    }
  };

  if (cur) {
    return (
      <Page>
        <button onClick={() => setCur(null)} className="text-sm text-muted-foreground hover:text-foreground mb-4">← {t("nav.playground")}</button>
        <h1 className="text-2xl font-bold text-foreground">{cur.title}</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-4">{cur.prompt}</p>
        <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} rows={10} aria-label={t("play.code")} className={`${inputCls} font-mono text-[13px] leading-relaxed`} onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); const el = e.currentTarget; const s = el.selectionStart; setCode(code.slice(0, s) + "  " + code.slice(el.selectionEnd)); requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2)); } }} />
        <button onClick={run} disabled={running} className={`${btnCls} mt-3`}>{running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} {t("play.run")}</button>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {results && (
          <ul className="mt-4 space-y-1.5">
            {results.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                {r.ok ? <Check size={16} className="text-emerald-600 mt-0.5" /> : <X size={16} className="text-destructive mt-0.5" />}
                <span className="font-mono text-[12px] text-muted-foreground">{cur.fn}({cur.tests[i]!.args.map((a) => JSON.stringify(a)).join(", ")}) → {r.ok ? JSON.stringify(cur.tests[i]!.expected) : r.error ?? `${r.got ?? "undefined"} ≠ ${JSON.stringify(cur.tests[i]!.expected)}`}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-[12px] text-muted-foreground">{t("play.honesty")}</p>
      </Page>
    );
  }
  return (
    <Page>
      <PageHeader icon={Terminal} title={t("play.title")} subtitle={t("play.subtitle")} />
      {list === null && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>}
      <ul className="space-y-2">
        {list?.map((e) => (
          <li key={e.id}><button onClick={() => open(e)} className="w-full text-left rounded-xl border border-border bg-card px-4 py-3 hover:bg-secondary flex items-center gap-3">
            <span className="font-medium text-foreground flex-1">{e.title}</span>
            <span className="text-[12px] text-muted-foreground">{t(`play.level.${e.level as "beginner" | "easy" | "medium"}`)}</span>
          </button></li>
        ))}
      </ul>
    </Page>
  );
}
