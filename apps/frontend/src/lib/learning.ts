import type { LearningGoal, LearningLevel, LearningStyle, PathStep } from "../services/api";
import type { Keys } from "../locales/en";
import type { T } from "./i18n";

export const GOAL_IDS: LearningGoal[] = ["frontend", "backend", "fullstack", "data-ai", "devops", "security", "systems"];
export const LEVEL_IDS: LearningLevel[] = ["beginner", "basics", "intermediate", "advanced"];
export const STYLE_IDS: LearningStyle[] = ["videos", "reading", "practice", "mixed"];

export const HOURS_OPTIONS = [2, 5, 8, 12, 20];
export const LANGUAGE_OPTIONS = ["JavaScript", "TypeScript", "Python", "Rust", "Go", "Java", "C++", "C#", "SQL"];

/** Sensible starting languages for each goal (the learner can change them). */
export const DEFAULT_LANGUAGES: Record<LearningGoal, string[]> = {
  frontend: ["JavaScript", "TypeScript"],
  backend: ["TypeScript", "Python"],
  fullstack: ["TypeScript"],
  "data-ai": ["Python"],
  devops: ["Python"],
  security: ["Python"],
  systems: ["Rust"],
};

/** Feed topics that go with each goal. */
export const GOAL_INTERESTS: Record<LearningGoal, string[]> = {
  frontend: ["Frontend"],
  backend: ["Backend", "Databases"],
  fullstack: ["Frontend", "Backend", "Databases"],
  "data-ai": ["AI & ML", "Databases"],
  devops: ["DevOps", "Cloud"],
  security: ["Security"],
  systems: ["Systems"],
};

export const KIND_LABEL_KEYS: Record<PathStep["kind"], Keys> = {
  orient: "kind.orient",
  learn: "kind.learn",
  practice: "kind.practice",
  project: "kind.project",
  read: "kind.read",
};

/** The translated name of a content type ("Course" / "Cours"). */
export function typeLabel(t: T, type: string): string {
  const key = `type.${type}` as Keys;
  const label = t(key);
  return label === key ? type : label;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
