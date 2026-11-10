import { useCallback, useEffect, useRef, useState } from "react";
import { Flag, Loader2, MessagesSquare, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { api, SkillLevel } from "../services/api";
import { useI18n } from "../lib/i18n";
import { btnCls, ghostCls, inputCls, Page, PageHeader, Section, Tabs } from "../components/PageHeader";

interface Room { id: string; name: string; topic: string; members: number; joined: boolean; owner: boolean }
interface Msg { id: string; body: string; at: string; author: string; mine: boolean }

export function CommunityScreen() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"rooms" | "mentors">("rooms");
  const [room, setRoom] = useState<Room | null>(null);
  if (room) return <RoomView room={room} onBack={() => setRoom(null)} />;
  return (
    <Page>
      <PageHeader icon={MessagesSquare} title={t("comm.title")} subtitle={t("comm.subtitle")} />
      <Tabs value={tab} onChange={setTab} items={[{ id: "rooms", label: t("comm.rooms") }, { id: "mentors", label: t("comm.mentors") }]} />
      {tab === "rooms" ? <Rooms onOpen={setRoom} /> : <Mentors />}
    </Page>
  );
}

function Rooms({ onOpen }: { onOpen: (r: Room) => void }) {
  const { t } = useI18n();
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const load = useCallback(() => { api.growth<{ rooms: Room[] }>("/rooms").then((r) => setRooms(r.data?.rooms ?? [])); }, []);
  useEffect(load, [load]);
  const create = async () => {
    const r = await api.growth<{ room: Room }>("/rooms", "POST", { name, topic });
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    setName(""); setTopic("");
    onOpen(r.data!.room);
  };
  const join = async (room: Room) => {
    const r = await api.growth(`/rooms/${room.id}/join`, "POST", {});
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    onOpen({ ...room, joined: true });
  };
  return (
    <>
      <Section title={t("comm.newRoom")}>
        <div className="flex gap-2 flex-wrap">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t("comm.roomName")} className={`${inputCls} flex-1 min-w-40`} />
          <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={60} placeholder={t("comm.roomTopic")} className={`${inputCls} w-40`} />
          <button disabled={name.trim().length < 3 || !topic.trim()} onClick={create} className={btnCls}><Plus size={15} /> {t("comm.create")}</button>
        </div>
        <p className="text-[12px] text-muted-foreground mt-2">{t("comm.rules")}</p>
      </Section>
      {rooms === null && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" /></div>}
      {rooms && rooms.length === 0 && <p className="text-center text-sm text-muted-foreground">{t("comm.noRooms")}</p>}
      <ul className="space-y-2">
        {rooms?.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1"><p className="font-medium text-foreground truncate">{r.name}</p><p className="text-[12px] text-muted-foreground">{r.topic} · {t("comm.members", { n: r.members })}</p></div>
            <button onClick={() => (r.joined ? onOpen(r) : join(r))} className={ghostCls}>{r.joined ? t("comm.open") : t("comm.join")}</button>
          </li>
        ))}
      </ul>
    </>
  );
}

function RoomView({ room, onBack }: { room: Room; onBack: () => void }) {
  const { t } = useI18n();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const last = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const poll = useCallback(async (full = false) => {
    const q = !full && last.current ? `?after=${encodeURIComponent(last.current)}` : "";
    const r = await api.growth<{ messages: Msg[] }>(`/rooms/${room.id}/messages${q}`);
    const incoming = r.data?.messages ?? [];
    if (full) { setMsgs(incoming); } else if (incoming.length) setMsgs((m) => [...m, ...incoming.filter((x) => !m.some((y) => y.id === x.id))]);
    if (incoming.length) last.current = incoming[incoming.length - 1]!.at;
  }, [room.id]);
  useEffect(() => { poll(true); const id = setInterval(() => poll(), 4000); return () => clearInterval(id); }, [poll]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    const r = await api.growth(`/rooms/${room.id}/messages`, "POST", { body });
    if (!r.success) { setText(body); return void toast.error(r.error || t("admin.error")); }
    poll();
  };
  const report = async (id: string) => {
    const r = await api.growth<{ hidden: boolean }>(`/messages/${id}/report`, "POST", {});
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    toast.success(t("comm.reported"));
    if (r.data?.hidden) poll(true);
  };
  const leave = async () => { await api.growth(`/rooms/${room.id}/membership`, "DELETE"); onBack(); };

  return (
    <Page>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">←</button>
        <h1 className="text-xl font-bold text-foreground flex-1 truncate">{room.name}</h1>
        <button onClick={leave} className={ghostCls}>{t("comm.leave")}</button>
      </div>
      <div className="rounded-2xl border border-border bg-card p-3 h-[50vh] overflow-y-auto space-y-2" aria-live="polite">
        {msgs.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">{t("comm.quiet")}</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`group max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "bg-primary text-white" : "bg-secondary text-foreground"}`}>
              {!m.mine && <p className="text-[11px] font-semibold opacity-70">{m.author}</p>}
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              {!m.mine && <button aria-label={t("comm.report")} onClick={() => report(m.id)} className="opacity-0 group-hover:opacity-70 focus:opacity-100 mt-0.5"><Flag size={11} /></button>}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 mt-3">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={t("comm.write")} className={inputCls} />
        <button type="submit" disabled={!text.trim()} aria-label={t("comm.send")} className={btnCls}><Send size={15} /></button>
      </form>
    </Page>
  );
}

interface Req { id: string; topic: string; message: string; status: string; reply: string | null; from?: string; to?: string }

function Mentors() {
  const { t } = useI18n();
  const [offering, setOffering] = useState("");
  const [seeking, setSeeking] = useState("");
  const [bio, setBio] = useState("");
  const [active, setActive] = useState(false);
  const [topic, setTopic] = useState("");
  const [found, setFound] = useState<Array<{ userId: string; name: string; bio: string | null; level: string }> | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [inbox, setInbox] = useState<{ received: Req[]; sent: Req[] }>({ received: [], sent: [] });

  const loadReq = useCallback(() => { api.growth<{ received: Req[]; sent: Req[] }>("/mentor/requests").then((r) => r.data && setInbox(r.data)); }, []);
  useEffect(() => {
    api.growth<{ profile: { offering: string[]; seeking: string[]; bio: string | null; active: boolean } | null }>("/mentor/profile").then((r) => {
      const p = r.data?.profile;
      if (p) { setOffering(p.offering.join(", ")); setSeeking(p.seeking.join(", ")); setBio(p.bio ?? ""); setActive(p.active); }
    });
    loadReq();
  }, [loadReq]);
  const list = (s: string) => s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const save = async () => {
    const r = await api.growth("/mentor/profile", "PUT", { offering: list(offering), seeking: list(seeking), bio: bio || null, active: true });
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    setActive(true);
    toast.success(t("common.saved"));
  };
  const leave = async () => { await api.growth("/mentor/profile", "DELETE"); setActive(false); setOffering(""); setSeeking(""); setBio(""); };
  const search = async () => {
    const r = await api.growth<{ mentors: NonNullable<typeof found> }>(`/mentor/match?topic=${encodeURIComponent(topic)}`);
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    setFound(r.data!.mentors);
  };
  const ask = async (toId: string) => {
    const r = await api.growth("/mentor/requests", "POST", { toId, topic: topic.trim().toLowerCase(), message });
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    toast.success(t("comm.requestSent"));
    setAsking(null); setMessage(""); loadReq();
  };
  const respond = async (id: string, accept: boolean) => {
    const contact = accept ? window.prompt(t("comm.contactPrompt")) : null;
    if (accept && !contact) return;
    const r = await api.growth(`/mentor/requests/${id}/respond`, "POST", { accept, contact });
    if (!r.success) return void toast.error(r.error || t("admin.error"));
    loadReq();
  };

  return (
    <>
      <Section title={t("comm.myProfile")}>
        <div className="space-y-2">
          <input value={offering} onChange={(e) => setOffering(e.target.value)} placeholder={t("comm.offering")} className={inputCls} />
          <p className="text-[12px] text-muted-foreground">{t("comm.offeringHelp")}</p>
          <input value={seeking} onChange={(e) => setSeeking(e.target.value)} placeholder={t("comm.seeking")} className={inputCls} />
          <input value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} placeholder={t("comm.bio")} className={inputCls} />
          <div className="flex gap-2"><button onClick={save} className={btnCls}>{active ? t("common.save") : t("comm.join")}</button>{active && <button onClick={leave} className={ghostCls}>{t("comm.stop")}</button>}</div>
        </div>
      </Section>
      <Section title={t("comm.find")}>
        <div className="flex gap-2"><input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("comm.findPh")} className={inputCls} /><button disabled={!topic.trim()} onClick={search} className={ghostCls}>{t("comm.search")}</button></div>
        {found && found.length === 0 && <p className="text-sm text-muted-foreground mt-3">{t("comm.noMentors")}</p>}
        <ul className="space-y-2 mt-3">
          {found?.map((m) => (
            <li key={m.userId} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-3"><div className="flex-1 min-w-0"><p className="font-medium text-foreground">{m.name} <span className="text-[12px] text-muted-foreground">· {t(`skills.level.${m.level as SkillLevel}`)}</span></p>{m.bio && <p className="text-[13px] text-muted-foreground">{m.bio}</p>}</div><button onClick={() => setAsking(asking === m.userId ? null : m.userId)} className={ghostCls}>{t("comm.ask")}</button></div>
              {asking === m.userId && (
                <div className="mt-3 space-y-2"><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={400} placeholder={t("comm.askPh")} className={inputCls} /><button disabled={message.trim().length < 10} onClick={() => ask(m.userId)} className={btnCls}>{t("comm.send")}</button></div>
              )}
            </li>
          ))}
        </ul>
      </Section>
      {(inbox.received.length > 0 || inbox.sent.length > 0) && (
        <Section title={t("comm.requests")}>
          <ul className="space-y-2">
            {inbox.received.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
                <p className="text-foreground"><b>{r.from}</b> · {r.topic}</p><p className="text-muted-foreground whitespace-pre-wrap">{r.message}</p>
                {r.status === "pending" ? <div className="flex gap-2 mt-2"><button onClick={() => respond(r.id, true)} className={btnCls}>{t("comm.accept")}</button><button onClick={() => respond(r.id, false)} className={ghostCls}>{t("comm.decline")}</button></div> : <p className="text-[12px] text-muted-foreground mt-1">{t(`comm.status.${r.status as "pending" | "accepted" | "declined"}`)}</p>}
              </li>
            ))}
            {inbox.sent.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
                <p className="text-foreground">→ <b>{r.to}</b> · {r.topic} · <span className="text-muted-foreground">{t(`comm.status.${r.status as "pending" | "accepted" | "declined"}`)}</span></p>
                {r.reply && <p className="text-primary mt-1">{r.reply}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
