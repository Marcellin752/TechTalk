import { describe, it, expect } from "vitest";
import { pathFor, tabFor } from "./routes";

describe("pathFor", () => {
  it("gives each kind of content its own address", () => {
    expect(pathFor({ id: "a", type: "video" })).toBe("/watch/a");
    expect(pathFor({ id: "a", type: "repo" })).toBe("/project/a");
    expect(pathFor({ id: "a", type: "article" })).toBe("/article/a");
    expect(pathFor({ id: "a", type: "social_post" })).toBe("/article/a");
  });

  it("has no page of its own for external resources", () => {
    for (const type of ["opportunity", "roadmap", "course", "doc", "paper", "exercise", "question"] as const) {
      expect(pathFor({ id: "a", type })).toBeNull();
    }
  });
});

describe("tabFor", () => {
  it("maps addresses to header tabs, treating content pages as the feed", () => {
    expect(tabFor("/")).toBe("feed");
    expect(tabFor("/watch/x")).toBe("feed");
    expect(tabFor("/learn")).toBe("learn");
    expect(tabFor("/path")).toBe("path");
    expect(tabFor("/practice")).toBe("practice");
    expect(tabFor("/kairos")).toBe("kairos");
    expect(tabFor("/people")).toBe("people");
    expect(tabFor("/u/ada")).toBe("people");
    expect(tabFor("/saved")).toBe("saved");
    expect(tabFor("/profile")).toBe("profile");
    expect(tabFor("/settings")).toBe("settings");
    expect(tabFor("/about")).toBe("about");
  });
});
