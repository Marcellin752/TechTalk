import { useEffect } from "react";

/* Per-page search and sharing metadata, set from the page that owns it. The app
   is client-rendered, so this serves browsers and crawlers that run JavaScript
   (Google does); private pages say "noindex" so only the public ones are listed. */

export const SITE_URL = ((import.meta.env.VITE_SITE_URL as string | undefined) || "https://t3chtalk.vercel.app").replace(/\/$/, "");
const SITE_NAME = "TechTalk";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

export interface SeoOptions {
  title?: string;
  description?: string;
  /** Path of the page, for the canonical address, e.g. "/people". */
  path?: string;
  image?: string | null;
  /** Keep this page out of search results (private, signed-in pages). */
  noindex?: boolean;
  type?: "website" | "profile" | "article";
  jsonLd?: Record<string, unknown> | null;
}

function setMeta(attr: "name" | "property", key: string, value: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (value === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setLink(rel: string, href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (href === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/** Pure: the values a page asks for, with sensible defaults. Exposed for tests. */
export function resolveSeo(o: SeoOptions, lang = "en") {
  const title = o.title ? `${o.title} · ${SITE_NAME}` : `${SITE_NAME}: ${lang === "fr" ? "apprends la tech, à ton rythme" : "learn tech, your way"}`;
  const description =
    o.description ??
    (lang === "fr"
      ? "TechTalk réunit les meilleurs cours, vidéos, exercices et projets gratuits, et en tire un parcours d'apprentissage fait pour toi, avec Kairos, ton mentor IA."
      : "TechTalk gathers the best free courses, videos, exercises and projects, and builds a learning path made for you, with Kairos, your AI mentor.");
  return {
    title,
    description: description.slice(0, 200),
    canonical: `${SITE_URL}${o.path ?? "/"}`,
    image: o.image || DEFAULT_IMAGE,
    robots: o.noindex ? "noindex, nofollow" : "index, follow",
    type: o.type ?? "website",
  };
}

export function useSeo(options: SeoOptions | null, lang = "en") {
  const key = JSON.stringify(options) + lang;
  useEffect(() => {
    if (!options) return; // another component owns this page's metadata
    const r = resolveSeo(options, lang);
    document.title = r.title;
    setMeta("name", "description", r.description);
    setMeta("name", "robots", r.robots);
    setLink("canonical", r.canonical);
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:type", r.type);
    setMeta("property", "og:title", r.title);
    setMeta("property", "og:description", r.description);
    setMeta("property", "og:url", r.canonical);
    setMeta("property", "og:image", r.image);
    setMeta("property", "og:locale", lang === "fr" ? "fr_FR" : "en_US");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", r.title);
    setMeta("name", "twitter:description", r.description);
    setMeta("name", "twitter:image", r.image);

    let ld = document.head.querySelector<HTMLScriptElement>("script#seo-jsonld");
    if (options.jsonLd) {
      if (!ld) {
        ld = document.createElement("script");
        ld.id = "seo-jsonld";
        ld.type = "application/ld+json";
        document.head.appendChild(ld);
      }
      ld.textContent = JSON.stringify(options.jsonLd);
    } else ld?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
