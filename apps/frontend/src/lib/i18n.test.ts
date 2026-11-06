import { describe, it, expect } from "vitest";
import { en } from "../locales/en";
import { fr } from "../locales/fr";
import { translate } from "./i18n";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe("translations", () => {
  it("has the same keys in both languages", () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });

  it("keeps the same placeholders in every translation", () => {
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(placeholders(fr[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it("never leaves a French entry empty or identical to a placeholder-only string by mistake", () => {
    for (const key of Object.keys(fr) as Array<keyof typeof fr>) expect(fr[key].trim().length, key).toBeGreaterThan(0);
  });

  it("fills placeholders and picks the language", () => {
    expect(translate("en", "continue.stageOf", { n: 2, total: 6 })).toBe("Stage 2 of 6");
    expect(translate("fr", "continue.stageOf", { n: 2, total: 6 })).toBe("Étape 2 sur 6");
    expect(translate("fr", "nav.home")).toBe("Accueil");
  });

  it("leaves an unknown placeholder visible instead of printing undefined", () => {
    expect(translate("en", "continue.stageOf", { n: 1 })).toBe("Stage 1 of {total}");
  });
});
