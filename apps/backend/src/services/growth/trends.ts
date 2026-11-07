/* What is rising in the tech the platform watches: the share of recent content on a topic against the period before. */

export interface Trend { topic: string; recent: number; previous: number; change: number }

export function risingTopics(rows: Array<{ categories: string[] | null; createdAt: Date }>, now: Date, windowDays = 30, minRecent = 3): Trend[] {
  const w = windowDays * 86_400_000;
  const recent = new Map<string, number>();
  const previous = new Map<string, number>();
  let nRecent = 0;
  let nPrev = 0;
  for (const r of rows) {
    const age = now.getTime() - r.createdAt.getTime();
    if (age < 0 || age >= 2 * w) continue;
    const bucket = age < w ? recent : previous;
    age < w ? nRecent++ : nPrev++;
    for (const c of new Set((r.categories ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean))) bucket.set(c, (bucket.get(c) ?? 0) + 1);
  }
  const out: Trend[] = [];
  for (const [topic, n] of recent) {
    if (n < minRecent) continue;
    const p = previous.get(topic) ?? 0;
    // Compare shares, not raw counts: a source that simply published more must not look like a trend.
    const shareNow = n / Math.max(1, nRecent);
    const sharePrev = p / Math.max(1, nPrev);
    out.push({ topic, recent: n, previous: p, change: Math.round((shareNow - sharePrev) * 1000) / 10 });
  }
  return out.sort((a, b) => b.change - a.change);
}
