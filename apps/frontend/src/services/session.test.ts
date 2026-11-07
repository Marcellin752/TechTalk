import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* A tiny localStorage and window, enough for the session code. */
function stubBrowser() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("window", { setTimeout, location: { reload: vi.fn() } });
  return store;
}

const user = { id: "u1", name: "Alex", email: "a@b.c", role: "user" as const };
const json = (status: number, body: unknown) => Promise.resolve({ status, ok: status < 400, json: async () => body } as Response);

describe("session", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    vi.resetModules();
    store = stubBrowser();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("stores both tokens and the user after sign-in", async () => {
    const { api } = await import("./api");
    api.setSession({ token: "access-1", refreshToken: "refresh-1", user });
    expect(store.get("teachtalk_token")).toBe("access-1");
    expect(store.get("teachtalk_refresh")).toBe("refresh-1");
    expect(api.getUser()?.name).toBe("Alex");
  });

  it("trades the refresh token for a new pair", async () => {
    const { api } = await import("./api");
    api.setSession({ token: "old", refreshToken: "r1" });
    const fetchMock = vi.fn().mockReturnValue(json(200, { token: "new", refreshToken: "r2", user }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await api.tryRefresh()).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ refreshToken: "r1" });
    expect(store.get("teachtalk_token")).toBe("new");
    expect(store.get("teachtalk_refresh")).toBe("r2");
  });

  it("does not try to refresh without a refresh token", async () => {
    const { api } = await import("./api");
    api.setToken("only-access");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await api.tryRefresh()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails when the server refuses the refresh token", async () => {
    const { api } = await import("./api");
    api.setSession({ token: "old", refreshToken: "r1" });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(json(401, { error: "Invalid session" })));
    expect(await api.tryRefresh()).toBe(false);
  });

  it("treats a lost race with another tab as success", async () => {
    const { api } = await import("./api");
    api.setSession({ token: "old", refreshToken: "r1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        store.set("teachtalk_refresh", "r2-from-other-tab"); // the other tab won while we waited
        return json(401, { error: "Invalid session" });
      }),
    );
    expect(await api.tryRefresh()).toBe(true);
  });

  it("shares one refresh between simultaneous callers", async () => {
    const { api } = await import("./api");
    api.setSession({ token: "old", refreshToken: "r1" });
    const fetchMock = vi.fn().mockReturnValue(json(200, { token: "new", refreshToken: "r2" }));
    vi.stubGlobal("fetch", fetchMock);
    await Promise.all([api.tryRefresh(), api.tryRefresh(), api.tryRefresh()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("logout clears everything and retires the refresh token on the server", async () => {
    const { api } = await import("./api");
    api.setSession({ token: "a", refreshToken: "r1", user });
    const fetchMock = vi.fn().mockReturnValue(json(204, {}));
    vi.stubGlobal("fetch", fetchMock);
    api.logout();
    expect(fetchMock.mock.calls[0]![0]).toMatch(/\/auth\/logout$/);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ refreshToken: "r1" });
    expect(store.size).toBe(0);
  });
});
