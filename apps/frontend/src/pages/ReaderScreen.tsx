import { ContentItem } from "../types/content";
import { RepoReader } from "./RepoReader";
import { VideoReader } from "./VideoReader";
import { ArticleReader } from "./ArticleReader";

interface ReaderScreenProps {
  item: ContentItem;
  onBack: () => void;
  onSave: () => void;
  isSaved: boolean;
  onOpenItem: (item: ContentItem) => void;
}

const EMBED_ALLOWED_HOSTS = new Set(["youtube.com", "www.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

function sanitizeEmbedCode(html: string | null | undefined): string {
  if (!html) return "";
  const match = html.match(/<iframe[^>]*\bsrc=["']([^"']+)["']/i);
  if (!match) return "";
  try {
    const url = new URL(match[1]);
    if (!EMBED_ALLOWED_HOSTS.has(url.hostname)) return "";
    if (!url.pathname.startsWith("/embed/")) return "";
    return `<iframe title="Embedded video player" src="${url.toString()}" width="100%" height="100%" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  } catch {
    return "";
  }
}

export function ReaderScreen({ item, onBack, onSave, isSaved, onOpenItem }: ReaderScreenProps) {
  if (item.type === "repo") return <RepoReader item={item} onBack={onBack} onSave={onSave} isSaved={isSaved} />;
  if (item.type === "video") {
    return <VideoReader item={item} embedHtml={sanitizeEmbedCode(item.embedCode)} onBack={onBack} onSave={onSave} isSaved={isSaved} onOpenItem={onOpenItem} />;
  }
  return <ArticleReader item={item} onBack={onBack} onSave={onSave} isSaved={isSaved} onOpenItem={onOpenItem} />;
}
