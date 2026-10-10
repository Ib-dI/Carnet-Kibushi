import { describe, it, expect, beforeEach } from "vitest";
import { createGate } from "./gate.js";

const session = email => ({ user: { email } });

let shown, opened, statuses;
const gate = () => createGate({
  openCarnet: email => { opened.push(email); return { email, start: async () => ({ status: statuses[email] || "ok" }) }; },
  show: (view, data) => shown.push(data === undefined ? view : [view, data?.email ?? data]),
});

beforeEach(() => { shown = []; opened = []; statuses = {}; });

describe("gate", () => {
  it("no session shows the login", async () => {
    const g = gate();
    await g.onAuth("INITIAL_SESSION", null);
    expect(shown).toEqual(["login"]);
  });

  it("a session opens the Carnet of that Membre", async () => {
    const g = gate();
    await g.onAuth("SIGNED_IN", session("a@x.fr"));
    expect(opened).toEqual(["a@x.fr"]);
    expect(shown).toEqual(["loading", ["carnet", "a@x.fr"]]);
  });

  it("ignores later events for the same Membre (token refresh, second tab)", async () => {
    const g = gate();
    await g.onAuth("SIGNED_IN", session("a@x.fr"));
    await g.onAuth("TOKEN_REFRESHED", session("a@x.fr"));
    await g.onAuth("SIGNED_IN", session("a@x.fr"));
    expect(opened).toEqual(["a@x.fr"]);
  });

  it("ignores a duplicate event while the Carnet is still opening", async () => {
    const g = gate();
    await Promise.all([g.onAuth("INITIAL_SESSION", session("a@x.fr")), g.onAuth("SIGNED_IN", session("a@x.fr"))]);
    expect(opened).toEqual(["a@x.fr"]);
  });

  it("a non-Membre sees the private page", async () => {
    statuses["e@x.fr"] = "not-member";
    const g = gate();
    await g.onAuth("SIGNED_IN", session("e@x.fr"));
    expect(shown.at(-1)).toEqual(["private", "e@x.fr"]);
  });

  it("offline shows the error, and a later event retries", async () => {
    statuses["a@x.fr"] = "offline";
    const g = gate();
    await g.onAuth("SIGNED_IN", session("a@x.fr"));
    expect(shown.at(-1)).toBe("offline");
    statuses["a@x.fr"] = "ok";
    await g.onAuth("TOKEN_REFRESHED", session("a@x.fr"));
    expect(shown.at(-1)).toEqual(["carnet", "a@x.fr"]);
  });

  it("signing out before the Carnet is open shows the login", async () => {
    statuses["e@x.fr"] = "not-member";
    const g = gate();
    await g.onAuth("SIGNED_IN", session("e@x.fr"));
    await g.onAuth("SIGNED_OUT", null);
    expect(shown.at(-1)).toBe("login");
  });

  it("signing out with the Carnet open reloads the page", async () => {
    const g = gate();
    await g.onAuth("SIGNED_IN", session("a@x.fr"));
    await g.onAuth("SIGNED_OUT", null);
    expect(shown.at(-1)).toBe("reload");
  });

  it("another Membre signing in while the Carnet is open reloads the page", async () => {
    const g = gate();
    await g.onAuth("SIGNED_IN", session("a@x.fr"));
    await g.onAuth("SIGNED_IN", session("b@x.fr"));
    expect(shown.at(-1)).toBe("reload");
    expect(opened).toEqual(["a@x.fr"]);
  });

  it("a sign-out during opening wins over the late result", async () => {
    let release;
    const g = createGate({
      openCarnet: email => ({ email, start: () => new Promise(r => { release = () => r({ status: "ok" }); }) }),
      show: v => shown.push(v),
    });
    const opening = g.onAuth("SIGNED_IN", session("a@x.fr"));
    await g.onAuth("SIGNED_OUT", null);
    release(); await opening;
    expect(shown).toEqual(["loading", "login"]);
  });
});
