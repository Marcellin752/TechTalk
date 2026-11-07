import {
  siArxiv, siCodeforces, siCodewars, siCodingame, siDatacamp, siDocker, siDrizzle, siExercism, siFastify, siFreecodecamp, siGithub, siGooglegemini,
  siMdnwebdocs, siNodedotjs, siPostgresql, siReact, siRender, siStackoverflow, siSupabase, siTailwindcss, siTheodinproject, siTypescript, siVercel, siVite, siYoutube,
} from "simple-icons";

/** A logo to show: its shape (from the simple-icons set, CC0) and its colour, or just its name when no shape exists. */
export interface Brand {
  name: string;
  /** SVG path in a 24x24 box. */
  path?: string;
  hex: string;
}

const b = (i: { title: string; path: string; hex: string }, name = i.title): Brand => ({ name, path: i.path, hex: `#${i.hex}` });

/** Where the learning material comes from. A few have no logo in the set: they are shown by name. */
export const SOURCES: Brand[] = [
  b(siYoutube), b(siGithub), b(siFreecodecamp), b(siMdnwebdocs, "MDN Web Docs"), b(siCodewars), b(siCodeforces), b(siCodingame), b(siExercism),
  b(siStackoverflow, "Stack Overflow"), b(siArxiv), b(siDatacamp), b(siTheodinproject, "The Odin Project"),
  { name: "roadmap.sh", hex: "#6d4aff" }, { name: "CS50", hex: "#a51c30" }, { name: "MIT OpenCourseWare", hex: "#a31f34" },
];

/** What TechTalk is built with. */
export const STACK: Brand[] = [
  b(siReact), b(siTypescript), b(siVite), b(siTailwindcss, "Tailwind CSS"), b(siNodedotjs, "Node.js"), b(siFastify), b(siPostgresql, "PostgreSQL"), b(siDrizzle, "Drizzle ORM"),
  b(siSupabase), b(siVercel), b(siRender), b(siDocker), b(siGooglegemini, "Gemini"), { name: "Groq", hex: "#f55036" },
];
