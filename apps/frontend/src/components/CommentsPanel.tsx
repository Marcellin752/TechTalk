import { useCallback, useEffect, useState } from "react";
import { Send, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { api, CommentItem } from "../services/api";

const MAX = 1000;

function ago(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function CommentsPanel({ contentId, onTotal }: { contentId: string; onTotal?: (n: number) => void }) {
  const me = api.getUser();
  const [items, setItems] = useState<CommentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.getComments(contentId);
      setItems(res.comments);
      setTotal(res.total);
      onTotal?.(res.total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [contentId, onTotal]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await api.addComment(contentId, body);
    setSending(false);
    if (res.success && res.comment) {
      setItems((prev) => [res.comment!, ...prev]);
      setTotal((t) => t + 1);
      onTotal?.(total + 1);
      setDraft("");
    } else toast.error(res.error || "Could not post the comment.");
  };

  const remove = async (id: string) => {
    if (await api.deleteComment(id)) {
      setItems((prev) => prev.filter((c) => c.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      onTotal?.(Math.max(0, total - 1));
    } else toast.error("Could not delete the comment.");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2.5">
        <span className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
          {me?.picture ? <img src={me.picture} alt="" className="w-full h-full object-cover" /> : <User size={14} className="text-muted-foreground" />}
        </span>
        <div className="flex-1 min-w-0">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void send();
            }}
            rows={2}
            placeholder="Add a comment…"
            aria-label="Add a comment"
            className="w-full resize-none bg-transparent border-b border-border focus:border-primary outline-none text-sm text-foreground placeholder:text-muted-foreground py-1.5 transition-colors"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] font-mono text-muted-foreground">{draft.length}/{MAX}</span>
            <button
              onClick={send}
              disabled={!draft.trim() || sending}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary text-white text-xs font-semibold disabled:opacity-40"
            >
              <Send size={12} /> {sending ? "Posting…" : "Comment"}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-lg bg-secondary animate-pulse" />)}</div>
      ) : error ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          Couldn't load comments. <button onClick={load} className="text-primary underline">Retry</button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No comments yet. Start the conversation.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((c) => (
            <li key={c.id} className="flex gap-2.5 group">
              <span className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 overflow-hidden">
                {c.author.picture ? <img src={c.author.picture} alt="" className="w-full h-full object-cover" /> : <User size={14} className="text-muted-foreground" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-foreground truncate">{c.author.name}</span>
                  <span className="text-muted-foreground">{ago(c.createdAt)}</span>
                  {me?.id === c.author.id && (
                    <button
                      onClick={() => remove(c.id)}
                      aria-label="Delete comment"
                      className="ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-red-400 transition-opacity"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words mt-0.5">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
