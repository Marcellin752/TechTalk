import { Link } from "react-router-dom";
import { ArrowRight, Bot, BookOpen, Compass, Globe, Layers, Route as RouteIcon, Sparkles, Users } from "lucide-react";
import { PublicShell } from "../components/PublicShell";
import { useI18n } from "../lib/i18n";
import { SITE_URL, useSeo } from "../lib/seo";

const SOURCES = ["freeCodeCamp", "MIT OpenCourseWare", "CS50", "MDN", "arXiv", "Stack Overflow", "GitHub", "Codewars", "Codeforces", "CodinGame", "roadmap.sh", "The Odin Project"];

/** The public front door: what TechTalk is, in a minute, with one way in. */
export function LandingScreen() {
  const { t, lang } = useI18n();
  useSeo(
    {
      path: "/",
      type: "website",
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebSite", name: "TechTalk", url: SITE_URL, inLanguage: lang, potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/people?q={search_term_string}`, "query-input": "required name=search_term_string" } },
          { "@type": "Organization", name: "TechTalk", url: SITE_URL, logo: `${SITE_URL}/favicon.svg` },
        ],
      },
    },
    lang,
  );

  const features = [
    { icon: RouteIcon, title: t("land.f1.title"), text: t("land.f1.text") },
    { icon: Bot, title: t("land.f2.title"), text: t("land.f2.text") },
    { icon: BookOpen, title: t("land.f3.title"), text: t("land.f3.text") },
    { icon: Layers, title: t("land.f4.title"), text: t("land.f4.text") },
    { icon: Users, title: t("land.f5.title"), text: t("land.f5.text") },
    { icon: Globe, title: t("land.f6.title"), text: t("land.f6.text") },
  ];
  const steps = [
    { n: 1, title: t("land.step1"), text: t("land.step1.text") },
    { n: 2, title: t("land.step2"), text: t("land.step2.text") },
    { n: 3, title: t("land.step3"), text: t("land.step3.text") },
  ];

  return (
    <PublicShell>
      <section className="max-w-4xl mx-auto px-5 pt-16 sm:pt-24 pb-14 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-semibold">
          <Sparkles size={13} /> {t("land.badge")}
        </span>
        <h1 className="text-[2.1rem] sm:text-5xl font-bold tracking-tight text-foreground leading-[1.1] mt-5">{t("land.title")}</h1>
        <p className="text-[16px] sm:text-lg text-muted-foreground leading-relaxed mt-5 max-w-2xl mx-auto">{t("land.subtitle")}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <Link to="/login" className="inline-flex items-center gap-2 px-6 h-12 rounded-xl bg-primary text-white font-semibold shadow-lg shadow-primary/30">
            {t("land.cta")} <ArrowRight size={17} />
          </Link>
          <Link to="/people" className="inline-flex items-center gap-2 px-6 h-12 rounded-xl border border-border text-foreground font-medium hover:bg-secondary">
            <Compass size={17} /> {t("land.cta2")}
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 pb-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-border bg-card p-5">
              <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon size={19} />
              </span>
              <h2 className="text-[16px] font-semibold text-foreground mt-4">{title}</h2>
              <p className="text-[14px] text-muted-foreground leading-relaxed mt-1.5">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40">
        <div className="max-w-5xl mx-auto px-5 py-14">
          <h2 className="text-2xl font-bold tracking-tight text-foreground text-center">{t("land.how")}</h2>
          <ol className="grid md:grid-cols-3 gap-8 mt-10">
            {steps.map((s) => (
              <li key={s.n} className="text-center">
                <span className="w-10 h-10 rounded-full bg-primary text-white font-bold flex items-center justify-center mx-auto shadow-md shadow-primary/30">{s.n}</span>
                <h3 className="text-[16px] font-semibold text-foreground mt-4">{s.title}</h3>
                <p className="text-[14px] text-muted-foreground leading-relaxed mt-1.5">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 py-14 text-center">
        <p className="text-[12px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{t("land.sources")}</p>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4">
          {SOURCES.map((s) => (
            <li key={s} className="text-[14px] font-medium text-foreground/70">{s}</li>
          ))}
        </ul>
        <Link to="/login" className="inline-flex items-center gap-2 px-6 h-12 rounded-xl bg-primary text-white font-semibold shadow-lg shadow-primary/30 mt-10">
          {t("land.cta")} <ArrowRight size={17} />
        </Link>
      </section>

      <footer className="border-t border-border">
        <p className="max-w-6xl mx-auto px-5 py-6 text-[12px] text-muted-foreground">TechTalk · {t("land.footer")}</p>
      </footer>
    </PublicShell>
  );
}
