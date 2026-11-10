import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, ExternalLink, Github, Globe, Link2, Lock, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import { api, PublicProfile } from "../services/api";
import { useI18n } from "../lib/i18n";
import { SITE_URL, useSeo } from "../lib/seo";
import { Avatar } from "./PeopleScreen";
import { LanguageBar, ProjectsGrid } from "../components/DeveloperProfile";
import { KIND_LABEL_KEYS, formatMinutes, typeLabel } from "../lib/learning";

/** Someone's public page: only what they chose to show, and their roadmap only if it is public. */
export function PublicProfileScreen() {
  const { handle = "" } = useParams();
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const me = api.getUser();

  useEffect(() => {
    let cancelled = false;
    setProfile(undefined);
    setFailed(false);
    api
      .getPublicProfile(handle)
      .then((p) => !cancelled && setProfile(p))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const desc = profile
    ? [profile.bio, profile.languages.slice(0, 3).map((l) => l.name).join(", "), profile.interests?.slice(0, 3).join(", ")].filter(Boolean).join(" · ")
    : undefined;
  useSeo(
    profile
      ? {
          title: `${profile.name} (@${profile.handle})`,
          description: desc || `${profile.name} on TechTalk`,
          path: `/u/${profile.handle}`,
          image: profile.picture,
          type: "profile",
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            mainEntity: {
              "@type": "Person",
              name: profile.name,
              alternateName: profile.handle,
              url: `${SITE_URL}/u/${profile.handle}`,
              image: profile.picture ?? undefined,
              description: profile.bio ?? undefined,
              knowsAbout: [...(profile.interests ?? []), ...profile.languages.map((l) => l.name)],
              sameAs: [profile.github?.url, profile.website].filter(Boolean) as string[],
              homeLocation: profile.location ? { "@type": "Place", name: profile.location } : undefined,
            },
          },
        }
      : { title: t("people.title"), noindex: true, path: `/u/${handle}` },
    lang,
  );

  if (profile === undefined && !failed) return <div className="max-w-3xl mx-auto px-5 py-10"><div className="h-48 rounded-2xl bg-secondary animate-pulse" /></div>;
  if (failed || profile === null || !profile) {
    return (
      <div className="max-w-md mx-auto px-5 py-20 text-center">
        <Lock size={28} className="mx-auto text-muted-foreground" />
        <p className="text-foreground font-medium mt-4">{t("pub.notFound")}</p>
        <Link to="/people" className="inline-flex mt-5 px-5 h-10 items-center rounded-xl bg-primary text-white text-sm font-semibold">{t("nav.people")}</Link>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${SITE_URL}/u/${profile.handle}`);
      toast.success(t("common.copied"));
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-16 space-y-8">
        <header className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start gap-4 sm:gap-5">
            <Avatar name={profile.name} src={profile.picture} size={80} />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">{profile.name}</h1>
              <p className="text-sm text-muted-foreground font-mono mt-0.5">@{profile.handle}</p>
              {profile.bio && <p className="text-sm text-foreground/80 leading-relaxed mt-2">{profile.bio}</p>}
              {(profile.location || profile.website) && (
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground mt-2">
                  {profile.location && <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {profile.location}</span>}
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noopener noreferrer nofollow me" className="inline-flex items-center gap-1.5 hover:text-primary">
                      <Globe size={13} /> {profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                    </a>
                  )}
                </p>
              )}
            </div>
            <button onClick={copy} aria-label={t("common.copy")} title={t("common.copy")} className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary flex-shrink-0">
              <Link2 size={17} />
            </button>
          </div>
          {profile.github && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-sm text-muted-foreground">
              {profile.github.url && (
                <a href={profile.github.url} target="_blank" rel="noopener noreferrer me" className="inline-flex items-center gap-1.5 hover:text-primary font-mono">
                  <Github size={14} /> @{profile.github.login}
                </a>
              )}
              <span><strong className="text-foreground">{profile.github.publicRepos}</strong> {t("pub.repos")}</span>
              <span className="inline-flex items-center gap-1"><Star size={13} /> <strong className="text-foreground">{profile.github.totalStars}</strong> {t("pub.stars")}</span>
              <span><strong className="text-foreground">{profile.github.followers}</strong> {t("pub.followers")}</span>
            </div>
          )}
        </header>

        {profile.languages.length > 0 && (
          <section>
            <h2 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">{t("pub.languages")}</h2>
            <LanguageBar languages={profile.languages} />
          </section>
        )}

        {profile.interests && profile.interests.length > 0 && (
          <section>
            <h2 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">{t("pub.interests")}</h2>
            <ul className="flex flex-wrap gap-2">
              {profile.interests.map((i) => <li key={i} className="px-3 py-1.5 rounded-full bg-secondary border border-border text-[13px] text-foreground">{i}</li>)}
            </ul>
          </section>
        )}

        {profile.projects && profile.projects.length > 0 && (
          <section>
            <h2 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">{t("pub.projects")}</h2>
            <ProjectsGrid repos={profile.projects} />
          </section>
        )}

        <section>
          <h2 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">{t("pub.path")}</h2>
          {profile.path ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-[17px] font-semibold text-foreground">{profile.path.title}</h3>
              <p className="text-[13px] text-muted-foreground mt-1">{t("pub.pathMeta", { percent: profile.path.percent, stages: profile.path.stages.length, weeks: profile.path.weeksTotal, hours: profile.path.hoursPerWeek })}</p>
              <div className="h-2 rounded-full bg-secondary overflow-hidden mt-3" role="progressbar" aria-valuenow={profile.path.percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-primary rounded-full" style={{ width: `${profile.path.percent}%` }} />
              </div>
              <ol className="mt-5 space-y-4">
                {profile.path.stages.map((s) => (
                  <li key={s.index}>
                    <div className="flex items-baseline gap-2">
                      <span className="w-6 h-6 rounded-full bg-secondary text-muted-foreground text-[12px] font-bold flex items-center justify-center flex-shrink-0">{s.index + 1}</span>
                      <h4 className="text-[14.5px] font-semibold text-foreground">{s.title}</h4>
                      <span className="text-[12px] text-muted-foreground ml-auto">{s.done}/{s.total}</span>
                    </div>
                    <ul className="mt-1.5 ml-8 divide-y divide-border">
                      {s.steps.map((st, i) => (
                        <li key={i} className="py-1.5 flex items-center gap-2.5 text-[13px]">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${st.status === "done" ? "bg-primary text-white" : "border border-border"}`} aria-label={st.status === "done" ? t("pub.done") : undefined}>
                            {st.status === "done" && <Check size={10} strokeWidth={3} />}
                          </span>
                          <a href={st.content.url} target="_blank" rel="noopener noreferrer" className={`min-w-0 flex-1 truncate hover:text-primary ${st.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}`}>{st.content.title}</a>
                          <span className="hidden sm:inline text-[11px] text-muted-foreground flex-shrink-0">{t(KIND_LABEL_KEYS[st.kind])} · {typeLabel(t, st.content.type)} · {formatMinutes(st.minutes)}</span>
                          <ExternalLink size={11} className="text-muted-foreground flex-shrink-0" />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              <Lock size={14} /> {t("pub.pathPrivate")}
            </p>
          )}
        </section>

        {!me && (
          <p className="text-center">
            <Link to="/login" className="inline-flex items-center px-6 h-11 rounded-xl bg-primary text-white text-sm font-semibold shadow-md shadow-primary/25">{t("pub.makeOwn")}</Link>
          </p>
        )}
      </article>
    </div>
  );
}
