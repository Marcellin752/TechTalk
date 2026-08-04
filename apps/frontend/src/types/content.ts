export type ContentSource = "Reddit" | "YouTube" | "Medium" | "Dev.to" | "TechCrunch";
export type ContentType = "article" | "video" | "social_post";

export interface ContentItem {
  id: string;
  type: ContentType;
  source: ContentSource;
  title: string;
  summary: string;
  image: string;
  duration?: string;
  readTime?: string;
  author: string;
  category: string;
  body: string;
  bodyHtml?: string;
  date: string;
  embedCode?: string | null;
}

export type AppScreen = "auth" | "app";
export type AppTab = "feed" | "saved" | "profile" | "settings" | "about";
