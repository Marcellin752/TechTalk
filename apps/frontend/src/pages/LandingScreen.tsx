import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, Code2, Compass, GraduationCap, Heart, Languages, Lock, MapPin, MessageCircleQuestion, Route as RouteIcon, ShieldCheck, Sparkles, UserRound, Users, Zap } from "lucide-react";
import { PublicShell } from "../components/PublicShell";
import { Marquee } from "../components/landing/Marquee";
import { HeroScene } from "../components/landing/HeroScene";
import { KairosDemo } from "../components/landing/KairosDemo";
import { RoadmapMock } from "../components/landing/RoadmapMock";
import { StackOrbit } from "../components/landing/StackOrbit";
import { KairosPortrait } from "../components/KairosArt";
import { SOURCES, STACK } from "../lib/brands";
import { useReducedMotion } from "../lib/motion";
import { useI18n } from "../lib/i18n";
import { SITE_URL, useSeo } from "../lib/seo";
import type { Keys } from "../locales/en";

const k = (key: string) => key as Keys;

const BENTO = [
  { icon: Zap, key: "feed", wide: true },
  { icon: RouteIcon, key: "path", wide: false },
  { icon: CalendarDays, key: "cal", wide: false },
  { icon: Code2, key: "practice", wide: false },
  { icon: GraduationCap, key: "school", wide: true },
  { icon: Users, key: "campus", wide: false },
] as const;

const CAPS = [
  { icon: UserRound, key: "1" },
  { icon: BookOpen, key: "2" },
  { icon: Sparkles, key: "3" },
  { icon: MapPin, key: "4" },
  { icon: CalendarDays, key: "5" },
  { icon: ShieldCheck, key: "6" },
] as const;

/** A card that tilts toward the pointer, in 3D. Flat for people who prefer less motion. */
function Tilt({ children, className = "", max = 8 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || reduced) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateZ(0)`;
  };
  const leave = () => ref.current && (ref.current.style.transform = "perspective(900px) rotateX(0) rotateY(0)");
  return <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={`transition-transform duration-200 ease-out will-change-transform ${className}`}>{children}</div>;
}

function SectionTitle({ eyebrow, title, text, center = true }: { eyebrow: string; title: string; text?: string; center?: boolean }) {
  return (
    <div className={`${center ? "text-center mx-auto" : ""} max-w-3xl`}>
      <p className="text-[12px] font-mono uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mt-3 leading-[1.12]">{title}</h2>
      {text && <p className="text-[16px] text-muted-foreground leading-relaxed mt-4">{text}</p>}
    </div>
  );
}

/** The public front door: what TechTalk is, how it works, and Kairos in detail. */
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
          { "@type": "FAQPage", mainEntity: [1, 2, 3, 4, 5, 6].map((n) => ({ "@type": "Question", name: t(k(`lp.faq.${n}.q`)), acceptedAnswer: { "@type": "Answer", text: t(k(`lp.faq.${n}.a`)) } })) },
        ],
      },
    },
    lang,
  );

  const cta = "inline-flex items-center justify-center gap-2 px-7 h-12 rounded-xl bg-primary text-white font-semibold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors";
  const ghost = "inline-flex items-center justify-center gap-2 px-7 h-12 rounded-xl border border-border bg-card/60 text-foreground font-medium hover:bg-secondary transition-colors";

  return (
    <PublicShell>
      {/* ---------------------------------- hero ---------------------------------- */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10 [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:56px_56px] opacity-[.35] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,#000,transparent)]" />
        <div aria-hidden className="absolute -top-40 left-1/2 -translate-x-1/2 -z-10 w-[900px] h-[520px] rounded-full bg-primary/20 blur-[130px]" />
        <div className="max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-16 grid lg:grid-cols-[1.05fr_1fr] gap-10 items-center">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 pl-1.5 pr-3.5 py-1 rounded-full border border-border bg-card/70 backdrop-blur text-[12.5px] font-medium text-foreground">
              <span className="px-2 py-0.5 rounded-full bg-primary text-white text-[11px] font-semibold">{t("lp.hero.new")}</span> {t("lp.hero.badge")}
            </span>
            <h1 className="text-[2.4rem] sm:text-6xl font-bold tracking-tight text-foreground leading-[1.04] mt-6">
              {t("lp.hero.title1")} <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">{t("lp.hero.title2")}</span>
            </h1>
            <p className="text-[16px] sm:text-[18px] text-muted-foreground leading-relaxed mt-6 max-w-xl mx-auto lg:mx-0">{t("lp.hero.sub")}</p>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mt-8">
              <Link to="/login" className={cta}>{t("lp.cta")} <ArrowRight size={17} /></Link>
              <a href="#how" className={ghost}><Compass size={17} /> {t("lp.cta2")}</a>
            </div>
            <ul className="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 mt-7 text-[13px] text-muted-foreground">
              {["lp.hero.p1", "lp.hero.p2", "lp.hero.p3"].map((p) => <li key={p} className="inline-flex items-center gap-1.5"><Check size={14} className="text-primary" /> {t(k(p))}</li>)}
            </ul>
          </div>
          <HeroScene />
        </div>
      </section>

      {/* ---------------------------------- logos ---------------------------------- */}
      <section aria-label={t("lp.logos.sources")} className="border-y border-border bg-secondary/40 py-10">
        <p className="text-center text-[12px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{t("lp.logos.sources")}</p>
        <div className="mt-4 space-y-1"><Marquee brands={SOURCES} label={t("lp.logos.sources")} /></div>
        <p className="text-center text-[12px] font-mono uppercase tracking-[0.18em] text-muted-foreground mt-8">{t("lp.logos.stack")}</p>
        <div className="mt-4"><Marquee brands={STACK} reverse label={t("lp.logos.stack")} /></div>
      </section>

      {/* ---------------------------------- everything ---------------------------------- */}
      <section className="max-w-6xl mx-auto px-5 py-20 sm:py-28">
        <SectionTitle eyebrow={t("lp.b.eyebrow")} title={t("lp.b.title")} text={t("lp.b.text")} />
        <div className="grid md:grid-cols-3 gap-4 mt-12">
          {BENTO.map(({ icon: Icon, key, wide }) => (
            <Tilt key={key} className={wide ? "md:col-span-2" : ""} max={5}>
              <article className="h-full rounded-3xl border border-border bg-card p-6 sm:p-7 overflow-hidden relative">
                <div aria-hidden className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-primary/10 blur-2xl" />
                <span className="relative w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><Icon size={21} /></span>
                <h3 className="relative text-[19px] font-semibold text-foreground mt-5">{t(k(`lp.b.${key}.title`))}</h3>
                <p className="relative text-[14.5px] text-muted-foreground leading-relaxed mt-2">{t(k(`lp.b.${key}.text`))}</p>
              </article>
            </Tilt>
          ))}
        </div>
      </section>

      {/* ---------------------------------- how it works ---------------------------------- */}
      <section id="how" className="scroll-mt-20 border-y border-border bg-secondary/40">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <SectionTitle eyebrow={t("lp.how.eyebrow")} title={t("lp.how.title")} />
          <ol className="relative grid md:grid-cols-3 gap-6 mt-14">
            <span aria-hidden className="hidden md:block absolute left-[16.6%] right-[16.6%] top-6 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            {[1, 2, 3].map((n) => (
              <li key={n} className="relative text-center">
                <span className="relative w-12 h-12 rounded-2xl bg-primary text-white text-lg font-bold flex items-center justify-center mx-auto shadow-lg shadow-primary/30">{n}</span>
                <h3 className="text-[18px] font-semibold text-foreground mt-5">{t(k(`lp.how.${n}.title`))}</h3>
                <p className="text-[14.5px] text-muted-foreground leading-relaxed mt-2 max-w-xs mx-auto">{t(k(`lp.how.${n}.text`))}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------- roadmap ---------------------------------- */}
      <section className="max-w-6xl mx-auto px-5 py-20 sm:py-28 grid lg:grid-cols-[1fr_1.15fr] gap-12 items-center">
        <div className="min-w-0">
          <SectionTitle center={false} eyebrow={t("lp.map.eyebrow")} title={t("lp.map.title")} text={t("lp.map.text")} />
          <ul className="mt-7 space-y-3">
            {[1, 2, 3].map((n) => (
              <li key={n} className="flex gap-3 text-[15px] text-foreground">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center flex-shrink-0"><Check size={12} strokeWidth={3} /></span>
                {t(k(`lp.map.b${n}`))}
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0 [perspective:1400px]">
          <div className="rounded-3xl border border-border bg-card shadow-2xl shadow-black/15 overflow-hidden [transform:rotateY(-9deg)_rotateX(5deg)] hover:[transform:rotateY(-2deg)_rotateX(1deg)] transition-transform duration-500 ease-out">
            <div className="flex items-center gap-1.5 px-4 h-10 border-b border-border bg-secondary/60">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" /><span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
              <span className="ml-3 text-[11px] font-mono text-muted-foreground">Epitech, year 1</span>
            </div>
            <div className="p-5 overflow-x-auto no-scrollbar"><RoadmapMock /></div>
          </div>
        </div>
      </section>

      {/* ---------------------------------- Kairos ---------------------------------- */}
      <section id="kairos" className="relative overflow-hidden border-y border-border bg-gradient-to-b from-primary/[.07] via-transparent to-transparent scroll-mt-20">
        <KairosPortrait className="hidden xl:block absolute -right-16 top-10 w-[420px] opacity-[.12]" />
        <div className="relative max-w-6xl mx-auto px-5 py-20 sm:py-28">
          <SectionTitle eyebrow={t("lp.kai.eyebrow")} title={t("lp.kai.title")} text={t("lp.kai.text")} />

          <div className="grid lg:grid-cols-[1fr_1.05fr] gap-8 mt-14 items-start">
            <div className="grid sm:grid-cols-2 gap-3.5">
              {CAPS.map(({ icon: Icon, key }) => (
                <Tilt key={key} max={6}>
                  <article className="h-full rounded-2xl border border-border bg-card p-5">
                    <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon size={17} /></span>
                    <h3 className="text-[15.5px] font-semibold text-foreground mt-3.5">{t(k(`lp.kai.c${key}.title`))}</h3>
                    <p className="text-[13.5px] text-muted-foreground leading-relaxed mt-1.5">{t(k(`lp.kai.c${key}.text`))}</p>
                  </article>
                </Tilt>
              ))}
            </div>
            <div className="lg:sticky lg:top-24">
              <p className="text-[12px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-3">{t("lp.kd.title")}</p>
              <KairosDemo />
            </div>
          </div>

          {/* how an answer is made */}
          <div className="mt-20">
            <h3 className="text-center text-xl sm:text-2xl font-bold tracking-tight text-foreground">{t("lp.kai.flow.title")}</h3>
            <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              {[1, 2, 3, 4].map((n) => (
                <li key={n} className="relative rounded-2xl border border-border bg-card p-5">
                  <span className="text-[11px] font-mono text-primary">0{n}</span>
                  <h4 className="text-[15.5px] font-semibold text-foreground mt-1.5">{t(k(`lp.kai.flow.${n}.title`))}</h4>
                  <p className="text-[13.5px] text-muted-foreground leading-relaxed mt-1.5">{t(k(`lp.kai.flow.${n}.text`))}</p>
                  {n < 4 && <ArrowRight aria-hidden size={16} className="hidden lg:block absolute -right-3.5 top-1/2 -translate-y-1/2 text-primary bg-background rounded-full z-10" />}
                </li>
              ))}
            </ol>
            <p className="text-center text-[13px] text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">{t("lp.kai.fine")}</p>
          </div>
        </div>
      </section>

      {/* ---------------------------------- schools ---------------------------------- */}
      <section className="max-w-6xl mx-auto px-5 py-20 sm:py-28">
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-8 sm:p-12 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <div aria-hidden className="absolute -left-24 -bottom-24 w-72 h-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative">
            <SectionTitle center={false} eyebrow={t("lp.sch.eyebrow")} title={t("lp.sch.title")} text={t("lp.sch.text")} />
            <Link to="/login" className={`${cta} mt-8`}>{t("lp.sch.cta")} <ArrowRight size={17} /></Link>
          </div>
          <ul className="relative space-y-3.5">
            {[1, 2, 3].map((n) => (
              <li key={n} className="flex gap-4 rounded-2xl border border-border bg-background/70 backdrop-blur p-4">
                <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">{n === 1 ? <GraduationCap size={19} /> : n === 2 ? <CalendarDays size={19} /> : <Lock size={19} />}</span>
                <div>
                  <h3 className="text-[15px] font-semibold text-foreground">{t(k(`lp.sch.b${n}.title`))}</h3>
                  <p className="text-[13.5px] text-muted-foreground leading-relaxed mt-0.5">{t(k(`lp.sch.b${n}.text`))}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------- under the hood ---------------------------------- */}
      <section className="border-y border-border bg-secondary/40 overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 pt-20">
          <SectionTitle eyebrow={t("lp.hood.eyebrow")} title={t("lp.hood.title")} text={t("lp.hood.text")} />
        </div>
        <div className="mt-6 pb-10"><StackOrbit brands={STACK.slice(0, 10)} /></div>
      </section>

      {/* ---------------------------------- trust ---------------------------------- */}
      <section className="max-w-6xl mx-auto px-5 py-20 sm:py-24">
        <div className="grid md:grid-cols-3 gap-5">
          {[{ n: 1, icon: ShieldCheck }, { n: 2, icon: Heart }, { n: 3, icon: Languages }].map(({ n, icon: Icon }) => (
            <article key={n} className="rounded-2xl border border-border bg-card p-6">
              <Icon size={22} className="text-primary" />
              <h3 className="text-[17px] font-semibold text-foreground mt-4">{t(k(`lp.trust.${n}.title`))}</h3>
              <p className="text-[14px] text-muted-foreground leading-relaxed mt-1.5">{t(k(`lp.trust.${n}.text`))}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------------------------------- FAQ ---------------------------------- */}
      <section className="max-w-3xl mx-auto px-5 pb-20 sm:pb-24">
        <SectionTitle eyebrow={t("lp.faq.eyebrow")} title={t("lp.faq.title")} />
        <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <details key={n} className="group p-5">
              <summary className="flex items-center gap-3 cursor-pointer list-none text-[15.5px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                <MessageCircleQuestion size={17} className="text-primary flex-shrink-0" />
                <span className="flex-1">{t(k(`lp.faq.${n}.q`))}</span>
                <ChevronDown size={18} className="text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="text-[14.5px] text-muted-foreground leading-relaxed mt-3 pl-8">{t(k(`lp.faq.${n}.a`))}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------------------------------- final call ---------------------------------- */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-amber-500 px-8 py-14 sm:py-16 text-center text-white shadow-2xl shadow-primary/30">
          <div aria-hidden className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-white/15 blur-3xl" />
          <h2 className="relative text-3xl sm:text-5xl font-bold tracking-tight leading-[1.1]">{t("lp.end.title")}</h2>
          <p className="relative text-[16px] sm:text-[18px] text-white/85 mt-4 max-w-xl mx-auto">{t("lp.end.text")}</p>
          <div className="relative flex flex-wrap items-center justify-center gap-3 mt-8">
            <Link to="/login" className="inline-flex items-center gap-2 px-7 h-12 rounded-xl bg-white text-primary font-semibold shadow-lg hover:bg-white/90 transition-colors">{t("lp.cta")} <ArrowRight size={17} /></Link>
            <Link to="/people" className="inline-flex items-center gap-2 px-7 h-12 rounded-xl border border-white/50 text-white font-medium hover:bg-white/10 transition-colors"><Users size={17} /> {t("lp.end.people")}</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
          <span className="font-semibold text-foreground">TechTalk</span>
          <span className="mr-auto">{t("land.footer")}</span>
          <Link to="/people" className="hover:text-foreground">{t("nav.people")}</Link>
          <Link to="/design" className="hover:text-foreground">Design</Link>
          <Link to="/login" className="hover:text-foreground">{t("common.signIn")}</Link>
        </div>
      </footer>
    </PublicShell>
  );
}
