import { useCallback, useEffect, useRef, useState } from "react";
import { Github, KeyRound, Check } from "lucide-react";
import { toast } from "sonner";
import { api, Identities } from "../services/api";
import { GoogleIcon } from "./GoogleIcon";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

/* One account, several ways in. Each row is either linked (with an Unlink
   action, disabled for the last remaining method) or offers to link. */
export function LinkedAccounts({ bare = false }: { bare?: boolean }) {
  const [ids, setIds] = useState<Identities | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const googleBtn = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const res = await api.getIdentities();
    if (res.success && res.identities) setIds(res.identities);
    else toast.error(res.error || "Could not load your sign-in methods.");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const methods = ids ? [ids.hasPassword, ids.google, ids.github].filter(Boolean).length : 0;

  const onGoogleCredential = useCallback(async (response: { credential: string }) => {
    setBusy("google");
    const res = await api.linkGoogle(response.credential);
    setBusy(null);
    if (res.success && res.identities) {
      setIds(res.identities);
      toast.success("Google account linked.");
    } else toast.error(res.error || "Could not link Google.");
  }, []);

  // Google's own button: the only supported way to obtain an id token.
  useEffect(() => {
    if (!ids || ids.google || !GOOGLE_CLIENT_ID) return;
    const mount = () => {
      const gis = window.google?.accounts?.id;
      if (!gis || !googleBtn.current) return;
      gis.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogleCredential });
      googleBtn.current.innerHTML = "";
      gis.renderButton(googleBtn.current, { type: "standard", theme: "outline", size: "large", text: "continue_with", width: 240 });
    };
    if (window.google?.accounts?.id) return mount();
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client?hl=en";
    script.async = true;
    script.onload = mount;
    document.head.appendChild(script);
  }, [ids, onGoogleCredential]);

  const linkGithub = async () => {
    setBusy("github");
    const res = await api.startGithubLink();
    if (res.success && res.url) window.location.assign(res.url);
    else {
      setBusy(null);
      toast.error(res.error || "Could not start GitHub linking.");
    }
  };

  const unlink = async (provider: "google" | "github") => {
    setBusy(provider);
    const res = await api.unlinkProvider(provider);
    setBusy(null);
    if (res.success && res.identities) {
      setIds(res.identities);
      toast.success(`${provider === "google" ? "Google" : "GitHub"} unlinked.`);
    } else toast.error(res.error || "Could not unlink.");
  };

  const savePassword = async () => {
    setBusy("password");
    const res = await api.setPassword(newPw, ids?.hasPassword ? currentPw : undefined);
    setBusy(null);
    if (res.success && res.identities) {
      setIds(res.identities);
      setPwOpen(false);
      setCurrentPw("");
      setNewPw("");
      toast.success(ids?.hasPassword ? "Password changed." : "Password added — you can now sign in with your email.");
    } else toast.error(res.error || "Could not save the password.");
  };

  if (!ids) return null;

  const row = "flex items-center justify-between gap-3 px-4 py-3.5";
  const status = (on: boolean) =>
    on ? (
      <span className="flex items-center gap-1 text-[11px] font-mono text-green-400">
        <Check size={12} /> Linked
      </span>
    ) : (
      <span className="text-[11px] font-mono text-muted-foreground">Not linked</span>
    );
  const unlinkBtn = (provider: "google" | "github") => (
    <button
      onClick={() => unlink(provider)}
      disabled={busy === provider || methods <= 1}
      title={methods <= 1 ? "This is your only way to sign in" : undefined}
      className="text-xs text-red-400 hover:underline disabled:opacity-40 disabled:no-underline font-mono"
    >
      Unlink
    </button>
  );

  return (
    <div className={bare ? "" : "mb-8"}>
      {!bare && <h3 className="text-[11px] font-mono text-muted-foreground uppercase tracking-[0.15em] mb-3">Connected accounts</h3>}
      <div className="rounded-2xl border border-border overflow-hidden bg-card divide-y divide-border">
        {/* Email + password */}
        <div>
          <div className={row}>
            <span className="flex items-center gap-2.5 text-sm text-foreground min-w-0">
              <KeyRound size={16} className="text-muted-foreground flex-shrink-0" />
              <span className="min-w-0">
                Email &amp; password
                <span className="block text-[11px] text-muted-foreground font-mono truncate">{ids.email}</span>
              </span>
            </span>
            <span className="flex items-center gap-3 flex-shrink-0">
              {status(ids.hasPassword)}
              <button onClick={() => setPwOpen((v) => !v)} className="text-xs text-primary hover:underline font-mono">
                {ids.hasPassword ? "Change" : "Add"}
              </button>
            </span>
          </div>
          {pwOpen && (
            <div className="px-4 pb-4 space-y-2.5">
              {ids.hasPassword && (
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Current password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
                />
              )}
              <input
                type="password"
                autoComplete="new-password"
                placeholder="New password (12+ chars, upper, lower, number, symbol)"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
              />
              <button
                onClick={savePassword}
                disabled={busy === "password" || !newPw || (ids.hasPassword && !currentPw)}
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
              >
                {busy === "password" ? "Saving..." : "Save password"}
              </button>
            </div>
          )}
        </div>

        {/* Google */}
        <div className={row}>
          <span className="flex items-center gap-2.5 text-sm text-foreground">
            <GoogleIcon /> Google
          </span>
          <span className="flex items-center gap-3">
            {status(ids.google)}
            {ids.google ? unlinkBtn("google") : GOOGLE_CLIENT_ID ? <div ref={googleBtn} className="min-w-[120px]" /> : (
              <span className="text-[11px] text-muted-foreground font-mono">Unavailable</span>
            )}
          </span>
        </div>

        {/* GitHub */}
        <div className={row}>
          <span className="flex items-center gap-2.5 text-sm text-foreground">
            <Github size={16} /> GitHub
          </span>
          <span className="flex items-center gap-3">
            {status(ids.github)}
            {ids.github ? (
              unlinkBtn("github")
            ) : (
              <button onClick={linkGithub} disabled={busy === "github"} className="text-xs text-primary hover:underline font-mono disabled:opacity-50">
                Link
              </button>
            )}
          </span>
        </div>
      </div>
      {!bare && (
        <p className="text-[11px] text-muted-foreground mt-2">Any linked method signs you into this same account. Keep at least one.</p>
      )}
    </div>
  );
}
