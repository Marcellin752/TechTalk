import { ContentSource } from "../types/content";

const SOURCE_STYLES: Record<string, { chip: string; dot: string }> = {
  Reddit: { chip: "bg-orange-500/15 text-orange-400 border-orange-500/25", dot: "bg-orange-500" },
  YouTube: { chip: "bg-red-600/15 text-red-400 border-red-600/25", dot: "bg-red-500" },
  Medium: { chip: "bg-emerald-600/15 text-emerald-400 border-emerald-600/25", dot: "bg-emerald-500" },
  "Dev.to": { chip: "bg-neutral-500/15 text-neutral-300 border-neutral-500/25", dot: "bg-neutral-400" },
  TechCrunch: { chip: "bg-lime-600/15 text-lime-400 border-lime-600/25", dot: "bg-lime-500" },
};

export function SourceBadge({ source }: { source: ContentSource }) {
  const s = SOURCE_STYLES[source] || { chip: "bg-blue-600/15 text-blue-400 border-blue-600/25", dot: "bg-blue-500" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${s.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {source}
    </span>
  );
}
