import { useState } from "react";
import { Github, X } from "lucide-react";
import { toast } from "sonner";
import { api, ProfileSettings, User } from "../services/api";
import { useI18n } from "../lib/i18n";

interface Props {
  user: User | null;
  settings: ProfileSettings | null;
  githubAvatar: string | null;
  githubBio: string | null;
  onClose: () => void;
  onSaved: (settings: ProfileSettings, user: User | null) => void;
}

const field = "w-full rounded-xl bg-secondary border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary";

/** Edit what appears on the profile: name, bio, location, website and photo. */
export function EditProfileDialog({ user, settings, githubAvatar, githubBio, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(user?.name ?? "");
  const [bio, setBio] = useState(settings?.bio ?? githubBio ?? "");
  const [location, setLocation] = useState(settings?.location ?? "");
  const [website, setWebsite] = useState(settings?.website ?? "");
  const [avatarUrl, setAvatarUrl] = useState(settings?.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const preview = avatarUrl.trim() || user?.picture || githubAvatar || null;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return void toast.error(t("profile.edit.nameRequired"));
    setSaving(true);
    let nextUser = user;
    if (trimmed !== user?.name) {
      const res = await api.updateProfile(trimmed);
      if (!res.success || !res.user) {
        setSaving(false);
        return void toast.error(res.error || t("path.saveError"));
      }
      nextUser = res.user;
    }
    const res = await api.saveProfileSettings({ bio: bio.trim(), location: location.trim(), website: website.trim(), avatarUrl: avatarUrl.trim() });
    setSaving(false);
    if (!res.success || !res.settings) return void toast.error(res.error || t("path.saveError"));
    toast.success(t("profile.edit.saved"));
    onSaved(res.settings, nextUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:px-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={t("profile.edit.title")}>
      <div className="bg-card border border-border sm:rounded-2xl rounded-t-2xl w-full max-w-lg max-h-[92dvh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-lg font-semibold text-foreground">{t("profile.edit.title")}</h2>
          <button onClick={onClose} aria-label={t("common.cancel")} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-4">
            {preview ? (
              <img src={preview} alt="" className="w-16 h-16 rounded-2xl object-cover border border-border flex-shrink-0" onError={(e) => ((e.currentTarget.style.visibility = "hidden"))} />
            ) : (
              <span className="w-16 h-16 rounded-2xl bg-primary/15 text-primary text-xl font-bold flex items-center justify-center flex-shrink-0">{(name.trim()[0] ?? "?").toUpperCase()}</span>
            )}
            <div className="min-w-0 flex-1">
              <label htmlFor="ep-avatar" className="block text-xs font-medium text-muted-foreground mb-1">{t("profile.edit.avatar")}</label>
              <input id="ep-avatar" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" inputMode="url" className={field} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 -mt-1">
            {githubAvatar && (
              <button type="button" onClick={() => setAvatarUrl(githubAvatar)} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border text-[12.5px] text-foreground hover:bg-secondary">
                <Github size={13} /> {t("profile.edit.useGithub")}
              </button>
            )}
            {avatarUrl && (
              <button type="button" onClick={() => setAvatarUrl("")} className="px-3 h-8 rounded-lg border border-border text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-secondary">
                {t("profile.edit.remove")}
              </button>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground -mt-2">{t("profile.edit.avatarHint")}</p>

          <div>
            <label htmlFor="ep-name" className="block text-xs font-medium text-muted-foreground mb-1">{t("profile.edit.name")}</label>
            <input id="ep-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={field} />
          </div>
          <div>
            <label htmlFor="ep-bio" className="block text-xs font-medium text-muted-foreground mb-1">{t("profile.edit.bio")}</label>
            <textarea id="ep-bio" value={bio} onChange={(e) => setBio(e.target.value.slice(0, 280))} rows={3} className={`${field} resize-none`} />
            <div className="flex justify-between text-[12px] text-muted-foreground mt-1">
              <span>{t("profile.edit.bioHint")}</span>
              <span className="font-mono">{bio.length}/280</span>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ep-loc" className="block text-xs font-medium text-muted-foreground mb-1">{t("profile.edit.location")}</label>
              <input id="ep-loc" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} className={field} />
            </div>
            <div>
              <label htmlFor="ep-web" className="block text-xs font-medium text-muted-foreground mb-1">{t("profile.edit.website")}</label>
              <input id="ep-web" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" inputMode="url" className={field} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 h-10 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary">{t("common.cancel")}</button>
          <button onClick={save} disabled={saving} className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50">
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
