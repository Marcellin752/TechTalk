import { describe, it, expect } from "vitest";
import { resolveSeo, SITE_URL } from "./seo";

describe("resolveSeo", () => {
  it("builds a titled, canonical, indexable page by default", () => {
    const r = resolveSeo({ title: "People", path: "/people" });
    expect(r.title).toBe("People · TechTalk");
    expect(r.canonical).toBe(`${SITE_URL}/people`);
    expect(r.robots).toBe("index, follow");
    expect(r.image).toMatch(/og-image\.png$/);
  });

  it("keeps private pages out of search results", () => {
    expect(resolveSeo({ title: "Settings", noindex: true }).robots).toBe("noindex, nofollow");
  });

  it("uses the language for the default title and description", () => {
    expect(resolveSeo({}, "fr").title).toContain("apprends");
    expect(resolveSeo({}, "en").description).toMatch(/learning path made for you/);
  });

  it("trims long descriptions and honours a custom image and type", () => {
    const r = resolveSeo({ description: "x".repeat(500), image: "https://img/x.png", type: "profile" });
    expect(r.description).toHaveLength(200);
    expect(r.image).toBe("https://img/x.png");
    expect(r.type).toBe("profile");
  });
});
