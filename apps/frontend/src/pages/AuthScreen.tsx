import { useEffect, useRef, useState } from "react";
import { Rss } from "lucide-react";
import { toast } from "sonner";
import { api, User as ApiUser } from "../services/api";
import { Field } from "../components/Field";
import { GoogleIcon } from "../components/GoogleIcon";

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
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const setupGis = () => {
      const gis = window.google?.accounts?.id;
      if (!gis || !googleBtnRef.current) return;
      gis.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      // Render the official Google Sign-In button, which manages its own click
      gis.renderButton(googleBtnRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        shape: "rectangular",
        width: 384,
        text: "continue_with",
      });
    };

    if (window.google?.accounts?.id) {
      setupGis();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = setupGis;
      document.body.appendChild(script);
      return () => {
        document.body.removeChild(script);
      };
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
        setError(res.error || "Google Sign-In failed");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.id) {
      toast.info(
        "Google Sign-In is coming soon! Please use standard email Sign In / Sign Up for now."
      );
      return;
    }
    // If the official button hasn't rendered yet, fall back to the One Tap prompt
    setGoogleLoading(true);
    window.google.accounts.id.prompt();
  };

  const handleSubmit = async () => {
    if (!email || !password || (mode === "signup" && !name)) {
      setError("Please fill out all fields.");
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
          setError(res.error || "Login failed");
        }
      } else {
        const res = await api.register(name, email, password);
        if (res.success) {
          // Auto sign in on registration success
          const loginRes = await api.login(email, password);
          if (loginRes.success && loginRes.user) {
            onAuthSuccess(loginRes.user);
          } else {
            setError("Account created! Please sign in manually.");
            setMode("login");
          }
        } else {
          setError(res.error || "Registration failed");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      {/* Wordmark */}
      <div className="mb-14 text-center">
        <div className="flex items-center gap-2.5 justify-center mb-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Rss size={16} className="text-white" />
          </div>
          <span className="text-[26px] font-bold tracking-tight text-foreground">TechTalk</span>
        </div>
        <p className="text-muted-foreground text-sm font-mono tracking-wide">
          TikTok for tech — discover, scroll, learn.
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
              {m === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl mb-4 font-mono">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {mode === "signup" && (
            <Field label="Name" type="text" placeholder="Alex Kim" value={name} onChange={setName} />
          )}
          <Field label="Email" type="email" placeholder="you@example.com" value={email} onChange={setEmail} />
          <Field label="Password" type="password" placeholder="••••••••" value={password} onChange={setPassword} />

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-primary text-white py-3.5 rounded-xl font-semibold text-sm mt-2 hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign In →" : "Create Account →"}
          </button>

          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-mono">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {GOOGLE_CLIENT_ID && !googleLoading ? (
            <div ref={googleBtnRef} className="w-full flex justify-center" />
          ) : (
            <button
              onClick={handleGoogleClick}
              disabled={googleLoading}
              className="w-full border border-border bg-secondary text-foreground py-3 rounded-xl font-medium text-sm hover:bg-muted transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              <GoogleIcon />
              {googleLoading ? "Signing in..." : "Continue with Google"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
