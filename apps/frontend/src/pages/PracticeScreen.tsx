import { useState } from "react";
import { Code2 } from "lucide-react";
import { Chip, ListState, SearchBox, useResourceList } from "../components/ResourceList";
import { ResourceCard } from "../components/LearnCards";
import { useI18n } from "../lib/i18n";
import type { Keys } from "../locales/en";

/* Practice: coding exercises from several platforms, and the best-answered
   questions from Stack Overflow. */

type Mode = "exercises" | "questions";

const PLATFORMS = ["", "Codewars", "Codeforces", "CodinGame"] as const;
const LEVELS: ReadonlyArray<readonly [string, Keys]> = [
  ["", "practice.anyLevel"],
  ["beginner", "level.beginner"],
  ["easy", "level.easy"],
  ["medium", "level.medium"],
  ["hard", "level.hard"],
];

export function PracticeScreen() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("exercises");
  const [platform, setPlatform] = useState("");
  const [level, setLevel] = useState("");
  const [search, setSearch] = useState("");

  const params =
    mode === "exercises"
      ? { type: "exercise", platform: platform || undefined, difficulty: level || undefined }
      : { type: "question" };
  const list = useResourceList(params, search);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-12">
        <header className="flex items-center gap-3 mb-1">
          <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Code2 size={20} />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t("practice.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "exercises" ? t("practice.hint.exercises") : t("practice.hint.questions")}
            </p>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 my-5">
          <div role="tablist" className="flex gap-2">
            <Chip active={mode === "exercises"} onClick={() => setMode("exercises")}>{t("practice.exercises")}</Chip>
            <Chip active={mode === "questions"} onClick={() => setMode("questions")}>{t("practice.questions")}</Chip>
          </div>
          <div className="sm:ml-auto w-full sm:w-auto">
            <SearchBox value={search} onChange={setSearch} placeholder={mode === "exercises" ? t("practice.search.exercises") : t("practice.search.questions")} />
          </div>
        </div>

        {mode === "exercises" && (
          <div className="flex flex-col gap-3 mb-5">
            <div className="flex gap-2 overflow-x-auto no-scrollbar" aria-label="Platform">
              {PLATFORMS.map((p) => (
                <Chip key={p} active={platform === p} onClick={() => setPlatform(p)}>
                  {p || t("practice.allPlatforms")}
                </Chip>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar" aria-label="Level">
              {LEVELS.map(([id, label]) => (
                <Chip key={id} active={level === id} onClick={() => setLevel(id)}>
                  {t(label)}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]">
          {list.items.map((r) => (
            <ResourceCard key={r.id} item={r} />
          ))}
        </div>

        <ListState loading={list.loading} error={list.error} count={list.items.length} hasMore={list.more} onMore={list.loadMore} onRetry={list.retry} empty={t("practice.empty")} />
      </div>
    </div>
  );
}
