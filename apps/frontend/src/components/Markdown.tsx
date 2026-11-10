import { Fragment, type ReactNode } from "react";
import type { KairosSource } from "../services/api";

/* A small, safe renderer for what Kairos writes: paragraphs, lists, **bold**,
   `code`, fenced code and [n] source markers. It builds React elements (no HTML
   string), so nothing the model says can inject markup. */

function inline(text: string, sources: KairosSource[] | null | undefined, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[\d{1,2}\])/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={key} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={key} className="px-1 py-0.5 rounded bg-secondary text-[0.9em] font-mono">{tok.slice(1, -1)}</code>);
    else {
      const n = Number(tok.slice(1, -1));
      const src = sources?.find((s) => s.n === n);
      out.push(
        src ? (
          <a key={key} href={src.url} target="_blank" rel="noopener noreferrer" title={src.title} className="inline-flex items-center justify-center min-w-[1.15rem] h-[1.15rem] px-1 mx-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold align-super no-underline hover:bg-primary hover:text-white">
            {n}
          </a>
        ) : (
          tok
        ),
      );
    }
    last = m.index! + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, sources }: { text: string; sources?: KairosSource[] | null }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) code.push(lines[i++]!);
      i++; // closing fence (or end of text)
      blocks.push(
        <pre key={k++} className="my-2 rounded-lg bg-background border border-border p-3 overflow-x-auto text-[12.5px] leading-relaxed">
          {lang && <span className="block mb-1.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">{lang}</span>}
          <code className="font-mono text-foreground">{code.join("\n")}</code>
        </pre>,
      );
    } else if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={k++} className={`my-1.5 pl-5 space-y-1 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, sources, `${k}-${j}`)}</li>
          ))}
        </Tag>,
      );
    } else if (line.trim() === "") {
      i++;
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i]!.trim() !== "" && !lines[i]!.trim().startsWith("```") && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]!)) para.push(lines[i++]!);
      blocks.push(
        <p key={k++} className="my-1.5 first:mt-0 last:mb-0">
          {para.map((l, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {inline(l, sources, `${k}-${j}`)}
            </Fragment>
          ))}
        </p>,
      );
    }
  }
  return <div className="text-[14px] leading-relaxed text-foreground/90 break-words">{blocks}</div>;
}
