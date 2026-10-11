import { describe, it, expect } from "vitest";
import { news } from "./news.js";

const ME = "moi@x.fr", PROF = "prof@x.fr";
const SINCE = "2026-10-10T12:00:00.000Z";
const entry = (id, author_email, created_at) => ({ id, author_email, created_at });
const comment = (id, entry_id, author_email, created_at) => ({ id, entry_id, author_email, created_at });

describe("news", () => {
  const state = {
    entries: [
      entry("old", PROF, "2026-10-09T10:00:00Z"),
      entry("new", PROF, "2026-10-11T08:00:00Z"),
      entry("mine", ME, "2026-10-11T09:00:00Z"),
    ],
    comments: [
      comment("c1", "old", PROF, "2026-10-11T08:30:00Z"),
      comment("c2", "old", PROF, "2026-10-11T08:31:00Z"),
      comment("c3", "old", ME, "2026-10-11T08:32:00Z"),
      comment("c4", "new", PROF, "2026-10-09T08:00:00Z"),
    ],
  };

  it("marks Entrées added by someone else since my last visit", () => {
    expect([...news(state, ME, SINCE).entries]).toEqual(["new"]);
  });

  it("counts Commentaires by someone else since my last visit, per Entrée", () => {
    expect(Object.fromEntries(news(state, ME, SINCE).comments)).toEqual({ old: 2 });
  });

  it("ignores case in e-mails", () => {
    expect([...news(state, ME.toUpperCase(), SINCE).entries]).toEqual(["new"]);
  });

  it("shows nothing on a first visit", () => {
    const n = news(state, ME, null);
    expect(n.entries.size + n.comments.size).toBe(0);
  });
});
