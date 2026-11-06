import { useEffect, useRef, useState } from "react";
import { Github, Rss } from "lucide-react";
import { toast } from "sonner";
import { Github } from "lucide-react";
import { api, User as ApiUser } from "../services/api";
import { useI18n } from "../lib/i18n";
import { Field } from "../components/Field";
import { GoogleIcon } from "../components/GoogleIcon";
import { ThemeToggle } from "../components/ThemeToggle";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            moment_listener?: (notification: { isSkippedMoment: () => boolean }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface AuthScreenProps {
  onAuthSuccess: (user: ApiUser) => void;
}

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const gisInitialized = useRef(false);
  const lastWidth = useRef(0);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let observer: ResizeObserver | null = null;

    const setupGis = () => {
      const gis = window.google?.accounts?.id;
      if (!gis || !googleBtnRef.current || gisInitialized.current) return;
      gisInitialized.current = true;

      gis.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });

      const renderButton = () => {
        const container = googleBtnRef.current;
        if (!container || !gis) return;
        const width = Math.max(container.clientWidth || 320, 200);
        if (lastWidth.current === width) return;
        lastWidth.current = width;
        gis.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          width,
          text: "continue_with",
          locale: lang,
        });
      };

      renderButton();
      observer = new ResizeObserver(renderButton);
      observer.observe(googleBtnRef.current);
    };

    if (window.google?.accounts?.id) {
      setupGis();
    } else {
      const script = document.createElement("script");
      script.src = `https://accounts.google.com/gsi/client?hl=${lang}`;
      script.async = true;
      script.defer = true;
      script.onload = setupGis;
      document.body.appendChild(script);
    }

    return () => {
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // §49 OAuth: the GitHub callback returns to /login with the session in the URL
  // fragment. Adopt it, then scrub the fragment so the token is not left in
  // history or visible in the address bar.
  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const token = params.get("gh_token");
    const error = params.get("gh_error");
    const unavailable = params.get("gh_unavailable");

    if (!token && !error && !unavailable) return;
    history.replaceState(null, "", window.location.pathname + window.location.search);

    if (unavailable) {
      setError("La connexion GitHub n'est pas configurée sur ce serveur.");
      return;
    }
    if (error) {
      setError(
        error === "cancelled"
          ? "Connexion GitHub annulée."
          : "La connexion GitHub a échoué. Réessayez ou utilisez l'e-mail."
      );
      return;
    }
    if (token) {
      setGithubLoading(true);
      api
        .adoptGithubToken(token)
        .then((res) => {
          if (res.success && res.user) onAuthSuccess(res.user);
          else setError(res.error || "La connexion GitHub a échoué.");
        })
        .finally(() => setGithubLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleCredential = async (response: { credential: string }) => {
    setGoogleLoading(true);
    try {
      const res = await api.googleLogin(response.credential);
      if (res.success && res.user) {
        onAuthSuccess(res.user);
      } else {
        setError(res.error || t("auth.googleFailed"));
      }
    } catch {
      setError(t("auth.unexpected"));
    } finally {
      setGoogleLoading(false);
    }
  };

  // The GitHub callback returns to /login with the session in the URL fragment.
  // Adopt it, then scrub the fragment so the token is not left in history.
  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const token = params.get("gh_token");
    const ghError = params.get("gh_error");
    const unavailable = params.get("gh_unavailable");
    if (!token && !ghError && !unavailable) return;
    history.replaceState(null, "", window.location.pathname + window.location.search);

    if (unavailable) {
      setError(t("auth.ghUnavailable"));
      return;
    }
    if (ghError) {
      setError(ghError === "cancelled" ? t("auth.ghCancelled") : t("auth.ghFailed"));
      return;
    }
    if (token) {
      setGithubLoading(true);
      api
        .adoptGithubToken(token)
        .then((res) => {
          if (res.success && res.user) onAuthSuccess(res.user);
          else setError(res.error || t("auth.ghFailed"));
        })
        .finally(() => setGithubLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGithubClick = () => {
    setGithubLoading(true);
    window.location.assign(api.githubStartUrl());
  };

  const handleGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.id) {
      toast.info(t("auth.googleSoon"));
      return;
    }
    setGoogleLoading(true);
    window.google.accounts.id.prompt();
  };

  const handleGithubClick = () => {
    setGithubLoading(true);
    window.location.assign(api.githubStartUrl());
  };

  const handleSubmit = async () => {
    if (!email || !password || (mode === "signup" && !name)) {
      setError(t("auth.fillAll"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await api.login(email, password);
        if (res.success && res.user) {
          onAuthSuccess(res.user);
        } else {
          setError(res.error || t("auth.loginFailed"));
        }
      } else {
        const res = await api.register(name, email, password);
        if (res.success) {
          const loginRes = await api.login(email, password);
          if (loginRes.success && loginRes.user) {
            onAuthSuccess(loginRes.user);
          } else {
            setError(t("auth.created"));
            setMode("login");
          }
        } else {
          setError(res.error || t("auth.registerFailed"));
        }
      }
    } catch (err) {
      setError(t("auth.unexpected"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      {/* Wordmark */}
      <div className="mb-14 text-center">
        <div className="flex items-center gap-2.5 justify-center mb-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Rss size={16} className="text-white" />
          </div>
          <span className="text-[26px] font-bold tracking-tight text-foreground">TechTalk</span>
        </div>
        <p className="text-muted-foreground text-sm font-mono tracking-wide">
          {t("auth.tagline")}
        </p>
      </div>

      <div className="w-full max-w-sm">
        {/* Mode toggle */}
        <div className="flex bg-secondary rounded-xl p-1 mb-8 border border-border">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                mode === m
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "login" ? t("auth.signIn") : t("auth.signUp")}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Le contenu tech, réuni.</p>
      </div>

      <div className="relative w-full max-w-sm">
        <div className="tt-card p-6 sm:p-8">
          {/* Mode toggle */}
          <div className="mb-8 flex gap-1 rounded-full border border-border bg-surface-2 p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-all ${
                  mode === m
                    ? "bg-surface-3 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "login" ? "Se connecter" : "S’inscrire"}
              </button>
            ))}
          </div>

        <div className="space-y-4">
          {mode === "signup" && (
            <Field label={t("auth.name")} type="text" placeholder="Alex Kim" value={name} onChange={setName} />
          )}
          <Field label={t("auth.email")} type="email" placeholder="you@example.com" value={email} onChange={setEmail} />
          <Field label={t("auth.password")} type="password" placeholder="••••••••" value={password} onChange={setPassword} />

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold text-sm mt-2 hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {loading ? t("auth.wait") : mode === "login" ? t("auth.signInGo") : t("auth.createGo")}
          </button>

          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-mono">{t("auth.or")}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {GOOGLE_CLIENT_ID && !googleLoading ? (
            <div ref={googleBtnRef} className="w-full h-12" />
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="tt-btn tt-btn-brand mt-2 w-full px-5 py-3 text-sm"
            >
              <GoogleIcon />
              {googleLoading ? t("auth.signingIn") : t("auth.google")}
            </button>
          )}

          <button
            onClick={handleGithubClick}
            disabled={githubLoading}
            className="w-full border border-border bg-secondary text-foreground py-3 rounded-xl font-medium text-sm hover:bg-muted transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            <Github size={17} />
            {githubLoading ? t("auth.signingIn") : t("auth.github")}
          </button>
        </div>
      </div>
    </div>
  );
}
