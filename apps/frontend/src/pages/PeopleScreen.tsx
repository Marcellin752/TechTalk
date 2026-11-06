import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users } from "lucide-react";
import { useEffect } from "react";
import { api, PublicProfileCard } from "../services/api";
import { useI18n } from "../lib/i18n";
import { useSeo } from "../lib/seo";

function Avatar({ name, src, size = 48 }: { name: string; src: string | null; size?: number }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span className="rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
export { Avatar };

/** The directory of learners who chose to be listed. Public: a stranger can search it. */
export function PeopleScreen() {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<PublicProfileCard[] | null>(null);
  const [failed, setFailed] = useState(false);

  useSeo({ title: t("people.title"), description: t("people.subtitle"), path: "/people", jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: t("people.title"), description: t("people.subtitle") } }, lang);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setFailed(false);
      api
        .listPublicProfiles(q)
        .then((p) => !cancelled && setPeople(p))
        .catch(() => !cancelled && setFailed(true));
    }, q ? 250 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-14">
        <header className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Users size={20} />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t("people.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("people.subtitle")}</p>
          </div>
        </header>

        <div className="relative max-w-md my-5">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("people.search")}
            aria-label={t("people.search")}
            className="w-full h-10 bg-secondary border border-border rounded-full pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>

        {failed ? (
          <p className="py-14 text-center text-sm text-muted-foreground">{t("common.couldNotLoad")}</p>
        ) : people === null ? (
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-36 rounded-xl bg-secondary animate-pulse" />)}
          </div>
        ) : people.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm text-foreground font-medium">{t("people.empty")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("people.emptyText")}</p>
          </div>
        ) : (
          <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]">
            {people.map((p) => (
              <li key={p.handle}>
                <Link to={`/u/${p.handle}`} className="block h-full rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-secondary/40 transition-colors p-4">
                  <span className="flex items-center gap-3">
                    <Avatar name={p.name} src={p.picture} />
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold text-foreground truncate">{p.name}</span>
                      <span className="block text-[12.5px] text-muted-foreground font-mono truncate">@{p.handle}</span>
                    </span>
                  </span>
                  {(p.languages.length > 0 || p.interests.length > 0) && (
                    <span className="flex flex-wrap gap-1.5 mt-3">
                      {p.languages.map((l) => <span key={l} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium">{l}</span>)}
                      {p.interests.map((i) => <span key={i} className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[11px]">{i}</span>)}
                    </span>
                  )}
                  {p.percent !== null && (
                    <span className="block mt-3">
                      <span className="block h-1.5 rounded-full bg-secondary overflow-hidden"><span className="block h-full bg-primary rounded-full" style={{ width: `${p.percent}%` }} /></span>
                      <span className="block text-[11.5px] text-muted-foreground mt-1">{t("people.pathPercent", { n: p.percent })}</span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
