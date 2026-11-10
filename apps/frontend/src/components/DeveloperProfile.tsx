import { useCallback, useEffect, useState } from "react";
import { ExternalLink, GitFork, Github, RefreshCw, Star, Users, FolderGit2 } from "lucide-react";
import { toast } from "sonner";
import { api, GithubProfile, GithubProfileState } from "../services/api";
import { compact, LANGUAGE_COLORS } from "./ContentCards";

function ago(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d < 1) return "today";
  if (d < 30) return `${d} d ago`;
  if (d < 365) return `${Math.floor(d / 30)} mo ago`;
  return `${Math.floor(d / 365)} y ago`;
}

export function languageColor(name: string): string {
  return LANGUAGE_COLORS[name] ?? "#7c7c86";
}

/** The developer part of the profile: who you are on GitHub, what you write in
 *  and what you have built. Hidden behind a prompt until GitHub is linked. */
export function useGithubProfile() {
  const [state, setState] = useState<GithubProfileState | null>(null);
  const [failed, setFailed] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getGithubProfile()
      .then((s) => !cancelled && setState(s))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    const res = await api.syncGithubProfile();
    setSyncing(false);
    if (res.success && res.state) {
      setState(res.state);
      toast.success(res.state.throttled ? "Already up to date." : "Imported from GitHub.");
    } else toast.error(res.error || "Could not refresh from GitHub.");
  }, []);

  return { state, failed, syncing, sync };
}

export function DeveloperHeader({ profile, syncing, onSync }: { profile: GithubProfile; syncing: boolean; onSync: () => void }) {
  const facts = [
    { icon: <FolderGit2 size={14} />, label: "Repos", value: profile.publicRepos },
    { icon: <Star size={14} />, label: "Stars", value: compact(profile.totalStars) },
    { icon: <Users size={14} />, label: "Followers", value: compact(profile.followers) },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4">
      {facts.map((f) => (
        <span key={f.label} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          {f.icon}
          <strong className="text-foreground">{f.value}</strong> {f.label}
        </span>
      ))}
      <button onClick={onSync} disabled={syncing} className="ml-auto inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:underline disabled:opacity-50">
        <RefreshCw size={12} className={syncing ? "animate-spin" : ""} /> {syncing ? "Importing…" : `Synced ${ago(profile.syncedAt)} · Refresh`}
      </button>
    </div>
  );
}

export function LanguageBar({ languages }: { languages: GithubProfile["languages"] }) {
  if (languages.length === 0) {
    return <p className="text-sm text-muted-foreground">No public code with a detected language yet.</p>;
  }
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-secondary" role="img" aria-label="Language breakdown">
        {languages.map((l) => (
          <span key={l.name} title={`${l.name} ${Math.round(l.share * 100)}%`} style={{ width: `${l.share * 100}%`, background: languageColor(l.name) }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
        {languages.map((l) => (
          <li key={l.name} className="inline-flex items-center gap-1.5 text-[13px] text-foreground">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: languageColor(l.name) }} />
            {l.name} <span className="text-muted-foreground">{Math.round(l.share * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProjectsGrid({ repos }: { repos: GithubProfile["topRepos"] }) {
  if (repos.length === 0) return <p className="text-sm text-muted-foreground">No public projects yet.</p>;
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {repos.map((r) => (
        <a
          key={r.url}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col rounded-xl border border-border bg-card hover:border-primary/50 transition-colors p-4 min-w-0"
        >
          <span className="flex items-center gap-2 font-mono text-[13px] font-semibold text-foreground">
            <span className="truncate">{r.name}</span>
            <ExternalLink size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
          </span>
          <span className="text-[12.5px] text-foreground/70 leading-snug mt-1.5 line-clamp-2 min-h-[2.4em]">{r.description || "No description."}</span>
          <span className="flex items-center flex-wrap gap-x-3.5 gap-y-1 mt-3 text-[12px] text-muted-foreground">
            {r.language && (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: languageColor(r.language) }} />
                {r.language}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Star size={12} className={r.stars ? "fill-current text-primary" : ""} /> {compact(r.stars)}
            </span>
            {r.forks > 0 && (
              <span className="inline-flex items-center gap-1">
                <GitFork size={12} /> {compact(r.forks)}
              </span>
            )}
            <span className="ml-auto">{ago(r.pushedAt)}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

/** Shown when no GitHub account is linked: the value of linking it. */
export function LinkGithubPrompt() {
  const [busy, setBusy] = useState(false);
  const link = async () => {
    setBusy(true);
    const res = await api.startGithubLink();
    if (res.success && res.url) window.location.assign(res.url);
    else {
      setBusy(false);
      toast.error(res.error || "Could not start GitHub linking.");
    }
  };
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
      <Github size={28} className="mx-auto text-muted-foreground" />
      <h3 className="text-base font-semibold text-foreground mt-3">Build your developer profile</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
        Link GitHub to show your projects and languages here, and to get a feed that matches what you actually code in.
      </p>
      <button onClick={link} disabled={busy} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60">
        <Github size={15} /> {busy ? "Redirecting…" : "Link GitHub"}
      </button>
    </div>
  );
}
