export type ContentSource = "Reddit" | "GitHub" | "YouTube" | "Medium" | "Dev.to" | "TechCrunch";
export type ContentType = "article" | "video" | "repo" | "opportunity" | "social_post";

/** Facts the GitHub provider stores next to a repository. */
export interface RepoMeta {
  stars?: number;
  forks?: number;
  language?: string | null;
  topics?: string[];
  license?: string | null;
  pushedAt?: string;
  owner?: string;
  avatarUrl?: string;
  /* Opportunities: a remote job or a beginner-friendly issue. */
  kind?: "job" | "issue";
  company?: string;
  location?: string;
  salary?: string | null;
  jobType?: string | null;
  tags?: string[];
  repo?: string;
  labels?: string[];
  comments?: number;
}

export interface ContentItem {
  id: string;
  type: ContentType;
  source: ContentSource;
  title: string;
  url: string;
  summary: string;
  image: string;
  duration?: string;
  readTime?: string;
  author: string;
  category: string;
  categories?: string[];
  body: string;
  bodyHtml?: string;
  date: string;
  embedCode?: string | null;
  meta?: RepoMeta;
  /** Why the personalised feed chose this item, when it can tell. */
  reason?: string | null;
}

export type AppScreen = "auth" | "app";
export type AppTab = "feed" | "saved" | "profile" | "settings" | "about";
