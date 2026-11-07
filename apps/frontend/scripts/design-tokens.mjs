/**
 * Builds public/design-tokens.json from src/styles/theme.css, so the design is available
 * to tools and AI assistants as data, and never drifts from the CSS that actually ships.
 *
 *   npm run design:tokens --workspace=apps/frontend
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Custom properties declared in the first block that starts with `selector {`. */
export function readBlock(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return {};
  const end = css.indexOf("\n}", start);
  const body = css.slice(start, end);
  const out = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

export function buildTokens(css) {
  const light = readBlock(css, ":root");
  const dark = readBlock(css, ".dark");
  const colorKeys = Object.keys(light).filter((k) => !["--font-size", "--font-weight-medium", "--font-weight-normal", "--radius", "--font-sans", "--font-mono"].includes(k));
  const colors = {};
  for (const k of colorKeys) colors[k.slice(2)] = { light: light[k], dark: dark[k] ?? light[k] };
  return {
    $description: "TechTalk design tokens, generated from apps/frontend/src/styles/theme.css. Do not edit by hand.",
    themes: ["light", "dark"],
    color: colors,
    radius: { base: light["--radius"], sm: "calc(var(--radius) - 4px)", md: "calc(var(--radius) - 2px)", lg: "var(--radius)", xl: "calc(var(--radius) + 4px)" },
    typography: {
      fontSans: '"Inter", system-ui, sans-serif',
      fontMono: '"JetBrains Mono", "Fira Code", monospace',
      baseSize: light["--font-size"],
      weights: { normal: Number(light["--font-weight-normal"]), medium: Number(light["--font-weight-medium"]), semibold: 600, bold: 700 },
      usage: {
        pageTitle: "text-2xl/3xl bold, tracking-tight",
        sectionTitle: "text-[15–17px] semibold",
        body: "text-sm (14px), leading-relaxed",
        caption: "text-xs / 12–13px, muted-foreground",
        eyebrow: "font-mono 11px uppercase, tracking 0.15em, primary or muted",
      },
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const css = readFileSync(join(root, "src/styles/theme.css"), "utf8");
  writeFileSync(join(root, "public/design-tokens.json"), JSON.stringify(buildTokens(css), null, 2) + "\n");
  console.log("public/design-tokens.json written");
}
