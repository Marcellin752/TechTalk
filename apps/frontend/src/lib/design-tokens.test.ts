import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error plain .mjs script without types
import { buildTokens } from "../../scripts/design-tokens.mjs";

const root = join(process.cwd());

describe("design tokens", () => {
  const css = readFileSync(join(root, "src/styles/theme.css"), "utf8");
  const tokens = buildTokens(css);

  it("public/design-tokens.json is up to date (run `npm run design:tokens`)", () => {
    const shipped = JSON.parse(readFileSync(join(root, "public/design-tokens.json"), "utf8"));
    expect(shipped).toEqual(tokens);
  });

  it("has a light and a dark value for the main colours", () => {
    for (const name of ["background", "foreground", "primary", "secondary", "muted-foreground", "border", "destructive"]) {
      expect(tokens.color[name].light, name).toBeTruthy();
      expect(tokens.color[name].dark, name).toBeTruthy();
    }
    expect(tokens.color.background.light).not.toBe(tokens.color.background.dark);
  });
});
