import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Chip, ListState, SearchBox, useResourceList } from "../components/ResourceList";
import { ResourceCard } from "../components/LearnCards";
import { VideoCard } from "../components/ContentCards";
import { ContentItem } from "../types/content";
import { useI18n } from "../lib/i18n";
import type { Keys } from "../locales/en";

/* Learn: structured paths first, then videos, reference docs and research. */

type Tab = "roadmaps" | "courses" | "videos" | "docs" | "papers";

const TABS: Array<{ id: Tab; label: Keys; hint: Keys; params: Record<string, string> }> = [
  { id: "roadmaps", label: "learn.tab.roadmaps", hint: "learn.hint.roadmaps", params: { type: "roadmap" } },
  { id: "courses", label: "learn.tab.courses", hint: "learn.hint.courses", params: { type: "course" } },
  { id: "videos", label: "learn.tab.videos", hint: "learn.hint.videos", params: { type: "video", learn: "1" } },
  { id: "docs", label: "learn.tab.docs", hint: "learn.hint.docs", params: { type: "doc" } },
  { id: "papers", label: "learn.tab.papers", hint: "learn.hint.papers", params: { type: "paper" } },
];

const PAPER_KINDS = [
  ["", "learn.papers.all"],
  ["survey", "learn.papers.survey"],
  ["recent", "learn.papers.recent"],
] as const;

export function LearnScreen({ onOpen }: { onOpen: (item: ContentItem) => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("roadmaps");
  const [search, setSearch] = useState("");
  const [paperKind, setPaperKind] = useState("");
  const current = TABS.find((t) => t.id === tab)!;
  const params = { ...current.params, ...(tab === "papers" && paperKind ? { kind: paperKind } : {}) };
  const list = useResourceList(params, search);

  // Bigger programs first in "Courses".
  const items = tab === "courses" ? [...list.items].sort((a, b) => (b.meta?.blocks ?? 0) - (a.meta?.blocks ?? 0)) : list.items;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-12">
        <header className="flex items-center gap-3 mb-1">
          <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <BookOpen size={20} />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t("learn.title")}</h1>
            <p className="text-sm text-muted-foreground">{t(current.hint)}</p>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 my-5">
          <div role="tablist" className="flex gap-2 overflow-x-auto no-scrollbar">
            {TABS.map((tb) => (
              <Chip key={tb.id} active={tab === tb.id} onClick={() => setTab(tb.id)}>
                {t(tb.label)}
              </Chip>
            ))}
          </div>
          <div className="sm:ml-auto w-full sm:w-auto">
            <SearchBox value={search} onChange={setSearch} placeholder={t("learn.search", { what: t(current.label).toLowerCase() })} />
          </div>
        </div>

        {tab === "papers" && (
          <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
            {PAPER_KINDS.map(([id, label]) => (
              <Chip key={id} active={paperKind === id} onClick={() => setPaperKind(id)}>
                {t(label)}
              </Chip>
            ))}
          </div>
        )}

        {tab === "videos" ? (
          <div className="grid gap-x-4 gap-y-8 grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
            {items.map((v) => (
              <VideoCard key={v.id} item={v} onOpen={() => onOpen(v)} />
            ))}
          </div>
        ) : (
          <div className={`grid gap-4 ${tab === "papers" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]"}`}>
            {items.map((r) => (
              <ResourceCard key={r.id} item={r} />
            ))}
          </div>
        )}

        <ListState loading={list.loading} error={list.error} count={items.length} hasMore={list.more} onMore={list.loadMore} onRetry={list.retry} empty={t("learn.empty")} />
      </div>
    </div>
  );
}
