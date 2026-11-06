import type { AppTab, ContentItem } from "../types/content";

/** Every address the app answers to, in one place. */
export const ROUTES = {
  home: "/",
  login: "/login",
  learn: "/learn",
  path: "/path",
  onboarding: "/onboarding",
  practice: "/practice",
  kairos: "/kairos",
  people: "/people",
  saved: "/saved",
  profile: "/profile",
  settings: "/settings",
  about: "/about",
} as const;

export const TAB_PATHS: Record<AppTab, string> = {
  feed: ROUTES.home,
  learn: ROUTES.learn,
  path: ROUTES.path,
  practice: ROUTES.practice,
  kairos: ROUTES.kairos,
  people: ROUTES.people,
  saved: ROUTES.saved,
  profile: ROUTES.profile,
  settings: ROUTES.settings,
  about: ROUTES.about,
};

/** The page that shows one piece of content, chosen by what it is. Opportunities
 *  have no page of their own: they open their source. */
export function pathFor(item: Pick<ContentItem, "id" | "type">): string | null {
  if (item.type === "video") return `/watch/${item.id}`;
  if (item.type === "repo") return `/project/${item.id}`;
  // External resources open their own site: roadmaps, courses, docs, papers, exercises, questions.
  if (["opportunity", "roadmap", "course", "doc", "paper", "exercise", "question"].includes(item.type)) return null;
  return `/article/${item.id}`;
}

/** Which header/tab a pathname belongs to. Content pages count as the feed. */
export function tabFor(pathname: string): AppTab {
  if (pathname.startsWith(ROUTES.learn)) return "learn";
  if (pathname.startsWith(ROUTES.path)) return "path";
  if (pathname.startsWith(ROUTES.practice)) return "practice";
  if (pathname.startsWith(ROUTES.kairos)) return "kairos";
  if (pathname.startsWith(ROUTES.people) || pathname.startsWith("/u/")) return "people";
  if (pathname.startsWith(ROUTES.saved)) return "saved";
  if (pathname.startsWith(ROUTES.profile)) return "profile";
  if (pathname.startsWith(ROUTES.settings)) return "settings";
  if (pathname.startsWith(ROUTES.about)) return "about";
  return "feed";
}
