export type ContentSource = "Reddit" | "GitHub" | "YouTube" | "Medium" | "Dev.to" | "TechCrunch";
export type ContentType = "article" | "video" | "repo" | "opportunity" | "roadmap" | "course" | "doc" | "paper" | "exercise" | "question" | "social_post";

/** Facts the GitHub provider stores next to a repository. */
export interface RepoMeta {
  stars?: number;
  forks?: number;
  language?: string | null;
  license?: string | null;
  pushedAt?: string;
  owner?: string;
  avatarUrl?: string;
  /* Opportunities: a remote job or a beginner-friendly issue. */
  kind?: "job" | "issue" | "certification" | "track" | "survey";
  company?: string;
  location?: string;
  salary?: string | null;
  jobType?: string | null;
  tags?: string[];
  repo?: string;
  labels?: string[];
  comments?: number;
  /* Learn: courses, roadmaps, docs, papers, learning videos. */
  provider?: string;
  topics?: string[];
  level?: string;
  free?: boolean;
  blocks?: number;
  attribution?: string;
  authors?: string[];
  moreAuthors?: number;
  published?: string;
  field?: string;
  pdf?: string;
  durationSeconds?: number;
  learn?: boolean;
  /* Practice: exercises and questions. */
  platform?: string;
  difficulty?: "beginner" | "easy" | "medium" | "hard";
  rating?: number | string | null;
  solved?: number;
  score?: number;
  answers?: number;
  views?: number;
  languages?: string[];
}

/** A taxonomy tag (§9) as the feed and the tag endpoints return it. */
export interface ContentTag {
  id: string;
  slug: string;
  name: string;
  kind: "topic" | "skill" | "language" | "tool";
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
  publishedAt: string;
  likes: number;
  comments: number;
  views: number;
  embedCode?: string | null;
  meta?: RepoMeta;
  /** Why the personalised feed chose this item, when it can tell. */
  reason?: string | null;
  /** An item picked from outside the learner's domains, to widen the feed. */
  wildcard?: boolean;
}

export type AppScreen = "auth" | "app";
export type AppTab = "feed" | "learn" | "path" | "practice" | "kairos" | "people" | "saved" | "profile" | "settings" | "about";
