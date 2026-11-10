import { ContentItem } from "../types/content";

/** YouTube returns titles with HTML entities (&amp; &#39;); show them as text. */
function decodeEntities(text: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

export function mapBackendContentToItem(c: any): ContentItem {
  let image = c.image || "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=500&fit=crop&auto=format";
  let youtubeId = "";
  
  if (c.type === "video") {
    const match = c.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (match && match[1]) {
      youtubeId = match[1];
      image = c.image || `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
    } else if (!c.image) {
      image = "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=500&fit=crop&auto=format";
    }
  } else {
    if (!c.image) {
      if (c.source.toLowerCase().includes("techcrunch")) {
        image = "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=500&fit=crop&auto=format";
      } else if (c.source.toLowerCase().includes("reddit")) {
        image = "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=500&fit=crop&auto=format";
      }
    }
  }
  
  const wordCount = c.summary ? c.summary.split(/\s+/).length : 0;
  const readTime = c.type !== "video" ? `${Math.max(1, Math.round(wordCount / 180))} min` : undefined;
  
  let duration = undefined;
  if (c.type === "video" && c.meta?.durationSeconds) {
    const t = Number(c.meta.durationSeconds);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = String(t % 60).padStart(2, "0");
    duration = h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  } else if (c.type === "video") {
    const numericId = c.id.replace(/[^0-9]/g, '');
    const minutes = 3 + (parseInt(numericId.slice(0, 2) || '0', 10) % 15);
    const seconds = parseInt(numericId.slice(2, 4) || '0', 10) % 60;
    duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  let author = c.type === "repo" && c.meta?.owner ? c.meta.owner : "Tech Talker";
  if (c.source.toLowerCase().includes("dev.to")) {
    author = "Dev.to Contributor";
  } else if (c.source.toLowerCase().includes("techcrunch")) {
    author = "TechCrunch Staff";
  } else if (c.source.toLowerCase().includes("youtube")) {
    author = "YouTube Technical Channel";
  } else if (c.source.toLowerCase().includes("reddit")) {
    author = "Reddit Contributor";
  }

  let category = "Technology";
  if (c.categories && c.categories.length > 0) {
    category = c.categories[0];
  } else {
    const titleLower = c.title.toLowerCase();
    if (titleLower.includes("typescript") || titleLower.includes("js") || titleLower.includes("react") || titleLower.includes("frontend")) {
      category = "Web Development";
    } else if (titleLower.includes("rust") || titleLower.includes("c++") || titleLower.includes("systems")) {
      category = "Systems";
    } else if (titleLower.includes("ai") || titleLower.includes("gpt") || titleLower.includes("claude") || titleLower.includes("intelligence")) {
      category = "AI";
    } else if (titleLower.includes("database") || titleLower.includes("postgres") || titleLower.includes("sql")) {
      category = "Databases";
    } else if (titleLower.includes("kubernetes") || titleLower.includes("docker") || titleLower.includes("aws") || titleLower.includes("devops")) {
      category = "DevOps";
    }
  }

  return {
    id: c.id,
    type: c.type,
    source: c.source as any,
    title: decodeEntities(String(c.title ?? "")).replace(/\s+/g, " ").trim(),
    url: c.url,
    summary: c.summary || "No description available.",
    image,
    duration,
    readTime,
    author,
    category,
    categories: c.categories || undefined,
    body: c.summary || "No full text available.",
    bodyHtml: c.body || null,
    date: new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    embedCode: c.embedCode,
    meta: c.meta ?? undefined,
    reason: c.reason ?? null,
    wildcard: !!c.wildcard,
  };
}
