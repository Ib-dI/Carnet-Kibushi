import { describe, it, expect, beforeEach } from "vitest";
import { createCarnet } from "./carnet.js";
import { createMemoryServer } from "./memory-adapter.js";

const ALICE = "alice@exemple.fr", BOB = "bob@exemple.fr";
const MEMBERS = [{ email: ALICE, display_name: "Alice" }, { email: BOB, display_name: "Bob" }];
const tick = () => new Promise(r => setTimeout(r, 0));
const blob = (size = 10, type = "audio/webm") => new Blob([new Uint8Array(size)], { type });

let server;
const open = async (email = ALICE) => {
  const carnet = createCarnet({ ...server.connect(email), me: email });
  const res = await carnet.start();
  await tick();
  return { carnet, res };
};
const draft = (lesson_id, extra = {}) => ({ type: "mot", word: "mbote", translation: "bonjour", lesson_id, ...extra });

beforeEach(() => { server = createMemoryServer({ members: MEMBERS, langue: "kibushi" }); });

describe("start", () => {
  it("loads the Carnet for a Membre", async () => {
    const { carnet, res } = await open();
    expect(res.status).toBe("ok");
    expect(carnet.state.carnet.langue).toBe("kibushi");
    expect(carnet.state.members).toHaveLength(2);
  });

  it("reports a non-Membre", async () => {
    expect((await open("eve@exemple.fr")).res.status).toBe("not-member");
  });

  it("reports offline when loading fails", async () => {
    server.failNext("list");
    expect((await open()).res.status).toBe("offline");
  });
});

describe("names", () => {
  it("shows « toi » for me and the display name for others", async () => {
    const { carnet } = await open();
    expect(carnet.authorName(ALICE.toUpperCase())).toBe("toi");
    expect(carnet.authorName(BOB)).toBe("Bob");
    expect(carnet.authorName("")).toBe("");
    expect(carnet.myName()).toBe("Alice");
  });
});

describe("Leçons", () => {
  it("creates Leçons at the end", async () => {
    const { carnet } = await open();
    await carnet.saveLesson(null, { title: "Salutations" });
    const r = await carnet.saveLesson(null, { title: " Famille ", emoji: "👪", color: "ocre" });
    expect(r.ok).toBe(true);
    expect(carnet.state.lessons.map(l => [l.title, l.position])).toEqual([["Salutations", 1], ["Famille", 2]]);
  });

  it("refuses an empty title", async () => {
    const { carnet } = await open();
    expect(await carnet.saveLesson(null, { title: "  " })).toEqual({ ok: false, reason: "empty" });
  });

  it("renames a Leçon", async () => {
    const { carnet } = await open();
    const { value: l } = await carnet.saveLesson(null, { title: "Salutations" });
    await carnet.saveLesson(l, { title: "Bonjours", emoji: "👋", color: "brique" });
    expect(carnet.state.lessons[0]).toMatchObject({ title: "Bonjours", emoji: "👋", color: "brique" });
  });

  it("deleting a Leçon removes its Entrées and their Médias", async () => {
    const { carnet } = await open();
    const { value: l } = await carnet.saveLesson(null, { title: "Salutations" });
    await carnet.saveEntry(null, draft(l.id, { audio: { replace: blob() } }));
    expect(server.files.size).toBe(1);
    expect(await carnet.deleteLesson(l)).toEqual({ ok: true });
    expect(carnet.state.lessons).toEqual([]);
    expect(carnet.state.entries).toEqual([]);
    expect(server.files.size).toBe(0);
  });

  it("keeps everything when the delete fails", async () => {
    const { carnet } = await open();
    const { value: l } = await carnet.saveLesson(null, { title: "Salutations" });
    await carnet.saveEntry(null, draft(l.id, { audio: { replace: blob() } }));
    server.failNext("remove");
    expect(await carnet.deleteLesson(l)).toEqual({ ok: false, reason: "network" });
    expect(carnet.state.entries).toHaveLength(1);
    expect(server.files.size).toBe(1);
  });
});

describe("Entrées", () => {
  let carnet, lesson;
  beforeEach(async () => {
    ({ carnet } = await open());
    lesson = (await carnet.saveLesson(null, { title: "Salutations" })).value;
  });

  it("saves a trimmed Entrée stamped with its Autrice", async () => {
    const r = await carnet.saveEntry(null, draft(lesson.id, { word: " mbote ", note: " le matin " }));
    expect(r.ok).toBe(true);
    expect(carnet.state.entries[0]).toMatchObject({ word: "mbote", note: "le matin", author_email: ALICE, image_path: null, audio_path: null });
  });

  it("a Conseil has no Prononciation", async () => {
    await carnet.saveEntry(null, draft(lesson.id, { type: "conseil", pron: "m-bo-té" }));
    expect(carnet.state.entries[0].pron).toBe("");
  });

  it("refuses an empty Entrée, but accepts a Vocal alone", async () => {
    expect(await carnet.saveEntry(null, draft(lesson.id, { word: " ", translation: "" }))).toEqual({ ok: false, reason: "empty" });
    expect((await carnet.saveEntry(null, draft(lesson.id, { word: "", translation: "", audio: { replace: blob() } }))).ok).toBe(true);
  });

  it("refuses a Média over 10 Mo before uploading anything", async () => {
    const r = await carnet.saveEntry(null, draft(lesson.id, { audio: { replace: blob(10 * 1024 * 1024 + 1) } }));
    expect(r).toEqual({ ok: false, reason: "too-large", media: "audio" });
    expect(server.files.size).toBe(0);
  });

  it("uploads Médias under images/ and audio/ with a fitting extension", async () => {
    const opus = new File([new Uint8Array(4)], "note.opus", { type: "" });
    await carnet.saveEntry(null, draft(lesson.id, { image: { replace: blob(4, "image/jpeg") }, audio: { replace: opus } }));
    const e = carnet.state.entries[0];
    expect(e.image_path).toMatch(/^images\/.+\.jpg$/);
    expect(e.audio_path).toMatch(/^audio\/.+\.ogg$/);
    expect([...server.files.keys()].sort()).toEqual([e.audio_path, e.image_path].sort());
  });

  it("removes the uploaded files when the row write fails", async () => {
    server.failNext("insert");
    const r = await carnet.saveEntry(null, draft(lesson.id, { image: { replace: blob(4, "image/png") }, audio: { replace: blob() } }));
    expect(r).toEqual({ ok: false, reason: "network" });
    expect(server.files.size).toBe(0);
    expect(carnet.state.entries).toEqual([]);
  });

  it("removes the first upload when the second fails", async () => {
    // L'image passe en premier ; on fait échouer le Vocal.
    server.failNext("upload", 1, { skip: 1 });
    const r = await carnet.saveEntry(null, draft(lesson.id, { image: { replace: blob(4, "image/png") }, audio: { replace: blob() } }));
    expect(r).toEqual({ ok: false, reason: "network" });
    expect(server.files.size).toBe(0);
  });

  it("replacing a Média deletes the old file only after the row is saved", async () => {
    const { value: e } = await carnet.saveEntry(null, draft(lesson.id, { audio: { replace: blob() } }));
    const old = e.audio_path;
    server.failNext("update");
    await carnet.saveEntry(e, draft(lesson.id, { audio: { replace: blob() } }));
    expect(server.files.has(old)).toBe(true);
    expect(server.files.size).toBe(1);

    const r = await carnet.saveEntry(e, draft(lesson.id, { audio: { replace: blob() } }));
    expect(server.files.has(old)).toBe(false);
    expect(server.files.has(r.value.audio_path)).toBe(true);
  });

  it("keeps or removes existing Médias", async () => {
    const { value: e } = await carnet.saveEntry(null, draft(lesson.id, { audio: { replace: blob() }, image: { replace: blob(4, "image/png") } }));
    const { value: e2 } = await carnet.saveEntry(e, draft(lesson.id, { image: { remove: true } }));
    expect(e2.audio_path).toBe(e.audio_path);
    expect(e2.image_path).toBe(null);
    expect(server.files.has(e.image_path)).toBe(false);
  });

  it("deletes an Entrée and its Médias", async () => {
    const { value: e } = await carnet.saveEntry(null, draft(lesson.id, { audio: { replace: blob() } }));
    expect(await carnet.deleteEntry(e)).toEqual({ ok: true });
    expect(carnet.state.entries).toEqual([]);
    expect(server.files.size).toBe(0);
  });

  it("a failing Storage cleanup does not fail the delete", async () => {
    const { value: e } = await carnet.saveEntry(null, draft(lesson.id, { audio: { replace: blob() } }));
    server.failNext("storageRemove");
    expect(await carnet.deleteEntry(e)).toEqual({ ok: true });
  });
});

describe("Langue", () => {
  it("renames the Langue", async () => {
    const { carnet } = await open();
    expect((await carnet.renameLangue(" shimaore ")).ok).toBe(true);
    expect(carnet.state.carnet.langue).toBe("shimaore");
  });
});

describe("two Membres", () => {
  it("each sees the other's writes in real time", async () => {
    const a = (await open(ALICE)).carnet, b = (await open(BOB)).carnet;
    const { value: l } = await a.saveLesson(null, { title: "Salutations" });
    await b.saveEntry(null, draft(l.id));
    await tick();
    expect(a.state.entries).toHaveLength(1);
    expect(a.authorName(a.state.entries[0].author_email)).toBe("Bob");
    await b.deleteLesson(l);
    await tick();
    expect(a.state.lessons).toEqual([]);
    expect(a.state.entries).toEqual([]);
  });

  it("notifies listeners on every change", async () => {
    const a = (await open(ALICE)).carnet, b = (await open(BOB)).carnet;
    const seen = [];
    const off = a.onChange(s => seen.push(s.lessons.length));
    await b.saveLesson(null, { title: "Salutations" });
    await tick();
    off();
    await b.saveLesson(null, { title: "Famille" });
    await tick();
    expect(seen).toEqual([1]);
  });
});

describe("resync", () => {
  it("reloads after the realtime connection comes back", async () => {
    const a = (await open(ALICE)).carnet, b = (await open(BOB)).carnet;
    server.disconnect();
    await b.saveLesson(null, { title: "Pendant la coupure" });
    await tick();
    expect(a.state.lessons).toEqual([]);
    server.reconnect();
    await tick();
    expect(a.state.lessons.map(l => l.title)).toEqual(["Pendant la coupure"]);
  });

  it("resync() reloads on demand (tab visible again)", async () => {
    const { carnet } = await open();
    server.tables.lessons.push({ id: "x", title: "Ajoutée ailleurs", position: 1, created_at: "2026-01-01" });
    await carnet.resync();
    expect(carnet.state.lessons.map(l => l.id)).toEqual(["x"]);
  });

  it("keeps the state when a resync fails", async () => {
    const { carnet } = await open();
    await carnet.saveLesson(null, { title: "Salutations" });
    server.failNext("list");
    await carnet.resync();
    expect(carnet.state.lessons).toHaveLength(1);
  });

  it("does not lose an event that arrives while reloading", async () => {
    const a = (await open(ALICE)).carnet, b = (await open(BOB)).carnet;
    const reload = a.resync();
    await b.saveLesson(null, { title: "Pendant le rechargement" });
    await reload;
    await tick();
    expect(a.state.lessons.map(l => l.title)).toEqual(["Pendant le rechargement"]);
  });
});

describe("progress (Révision du jour)", () => {
  const TODAY = "2026-10-11";
  let a, lesson, entry;
  beforeEach(async () => {
    a = (await open(ALICE)).carnet;
    lesson = (await a.saveLesson(null, { title: "Salutations" })).value;
    entry = (await a.saveEntry(null, draft(lesson.id))).value;
  });

  it("records a first answer, then climbs a Boîte", async () => {
    expect((await a.recordAnswer(entry.id, "fr", "knew", TODAY)).ok).toBe(true);
    expect(a.state.progress).toMatchObject([{ entry_id: entry.id, direction: "fr", box: 2, due: "2026-10-14", member_email: ALICE }]);
    await a.recordAnswer(entry.id, "fr", "knew", "2026-10-14");
    expect(a.state.progress).toHaveLength(1);
    expect(a.state.progress[0]).toMatchObject({ box: 3, due: "2026-10-21" });
  });

  it("keeps one progress per Sens", async () => {
    await a.recordAnswer(entry.id, "fr", "knew", TODAY);
    await a.recordAnswer(entry.id, "lg", "again", TODAY);
    expect(a.state.progress.map(p => [p.direction, p.box]).sort()).toEqual([["fr", 2], ["lg", 1]]);
  });

  it("each Membre only sees their own progress", async () => {
    const b = (await open(BOB)).carnet;
    await a.recordAnswer(entry.id, "fr", "knew", TODAY);
    await b.recordAnswer(entry.id, "fr", "again", TODAY);
    await tick();
    expect(a.state.progress.map(p => p.box)).toEqual([2]);
    expect(b.state.progress.map(p => p.box)).toEqual([1]);
    await a.resync();
    expect(a.state.progress).toHaveLength(1);
  });

  it("deleting the Entrée drops its progress", async () => {
    await a.recordAnswer(entry.id, "fr", "knew", TODAY);
    await a.deleteEntry(entry);
    expect(a.state.progress).toEqual([]);
    expect(server.tables.progress).toEqual([]);
  });

  it("reports a failed write and keeps the state", async () => {
    server.failNext("upsert");
    expect(await a.recordAnswer(entry.id, "fr", "knew", TODAY)).toEqual({ ok: false, reason: "network" });
    expect(a.state.progress).toEqual([]);
  });
});

describe("Essais", () => {
  let a, b, lesson, entry;
  beforeEach(async () => {
    a = (await open(ALICE)).carnet;
    b = (await open(BOB)).carnet;
    lesson = (await a.saveLesson(null, { title: "Salutations" })).value;
    entry = (await a.saveEntry(null, draft(lesson.id, { audio: { replace: blob() } }))).value;
  });
  const mine = (c, email) => c.state.attempts.filter(t => t.member_email === email);

  it("saves my Essai, visible to the other Membre", async () => {
    const r = await b.saveAttempt(entry.id, blob());
    expect(r.ok).toBe(true);
    expect(r.value.audio_path).toMatch(/^audio\//);
    await tick();
    expect(mine(a, BOB)).toHaveLength(1);
    expect(a.attemptsOf(entry.id).map(t => t.member_email)).toEqual([BOB]);
  });

  it("a new Essai replaces mine and removes the old file", async () => {
    const first = (await b.saveAttempt(entry.id, blob())).value;
    const second = (await b.saveAttempt(entry.id, blob())).value;
    expect(mine(b, BOB)).toHaveLength(1);
    expect(second.audio_path).not.toBe(first.audio_path);
    expect(server.files.has(first.audio_path)).toBe(false);
    expect(server.files.has(second.audio_path)).toBe(true);
  });

  it("each Membre has their own Essai on the same Entrée", async () => {
    await a.saveAttempt(entry.id, blob());
    await b.saveAttempt(entry.id, blob());
    await tick();
    expect(a.attemptsOf(entry.id).map(t => t.member_email).sort()).toEqual([ALICE, BOB]);
  });

  it("refuses an Essai over 10 Mo, and cleans up when the row write fails", async () => {
    expect(await b.saveAttempt(entry.id, blob(10 * 1024 * 1024 + 1))).toEqual({ ok: false, reason: "too-large", media: "audio" });
    const before = server.files.size;
    server.failNext("upsert");
    expect(await b.saveAttempt(entry.id, blob())).toEqual({ ok: false, reason: "network" });
    expect(server.files.size).toBe(before);
  });

  it("deletes my Essai and its file", async () => {
    const t = (await b.saveAttempt(entry.id, blob())).value;
    expect(await b.deleteAttempt(t)).toEqual({ ok: true });
    expect(mine(b, BOB)).toEqual([]);
    expect(server.files.has(t.audio_path)).toBe(false);
  });

  it("cannot delete someone else's Essai", async () => {
    const t = (await b.saveAttempt(entry.id, blob())).value;
    await tick();
    await a.deleteAttempt(t);
    expect(server.tables.attempts).toHaveLength(1);
    expect(server.files.has(t.audio_path)).toBe(true);
  });

  it("deleting the Entrée removes all its Essais and their files", async () => {
    const t1 = (await a.saveAttempt(entry.id, blob())).value;
    const t2 = (await b.saveAttempt(entry.id, blob())).value;
    await tick();
    await a.deleteEntry(entry);
    expect(a.state.attempts).toEqual([]);
    expect(server.tables.attempts).toEqual([]);
    expect(server.files.has(t1.audio_path) || server.files.has(t2.audio_path)).toBe(false);
    expect(server.files.size).toBe(0);
  });

  it("deleting the Leçon removes the Essais' files too", async () => {
    await b.saveAttempt(entry.id, blob());
    await tick();
    await a.deleteLesson(lesson);
    expect(server.files.size).toBe(0);
  });
});

describe("Commentaires", () => {
  let a, b, entry;
  beforeEach(async () => {
    a = (await open(ALICE)).carnet;
    b = (await open(BOB)).carnet;
    const lesson = (await a.saveLesson(null, { title: "Salutations" })).value;
    entry = (await a.saveEntry(null, draft(lesson.id))).value;
  });

  it("adds a trimmed Commentaire, signed, seen by the other Membre", async () => {
    const r = await b.addComment(entry.id, "  accent sur la 2e syllabe  ");
    expect(r.ok).toBe(true);
    await tick();
    expect(a.commentsOf(entry.id)).toMatchObject([{ body: "accent sur la 2e syllabe", author_email: BOB }]);
  });

  it("lists Commentaires oldest first", async () => {
    await a.addComment(entry.id, "un");
    await b.addComment(entry.id, "deux");
    await tick();
    expect(a.commentsOf(entry.id).map(c => c.body)).toEqual(["un", "deux"]);
  });

  it("refuses an empty or too long Commentaire", async () => {
    expect(await a.addComment(entry.id, "   ")).toEqual({ ok: false, reason: "empty" });
    expect(await a.addComment(entry.id, "x".repeat(1001))).toEqual({ ok: false, reason: "too-long" });
  });

  it("deletes my own Commentaire, never someone else's", async () => {
    const mine = (await a.addComment(entry.id, "à moi")).value;
    const theirs = (await b.addComment(entry.id, "à Bob")).value;
    await tick();
    expect(await a.deleteComment(theirs)).toEqual({ ok: false, reason: "forbidden" });
    expect(await a.deleteComment(mine)).toEqual({ ok: true });
    await tick();
    expect(b.commentsOf(entry.id).map(c => c.body)).toEqual(["à Bob"]);
  });

  it("deleting the Entrée removes its Commentaires", async () => {
    await b.addComment(entry.id, "bientôt parti");
    await tick();
    await a.deleteEntry(entry);
    expect(a.state.comments).toEqual([]);
    expect(server.tables.comments).toEqual([]);
  });
});

describe("visits", () => {
  it("returns the previous visit and records the new one", async () => {
    const a = (await open(ALICE)).carnet;
    expect(await a.beginVisit("2026-10-10T10:00:00.000Z")).toBe(null);
    expect(await a.beginVisit("2026-10-11T10:00:00.000Z")).toBe("2026-10-10T10:00:00.000Z");
    expect(server.tables.visits).toHaveLength(1);
  });

  it("each Membre has their own last visit, shared across their devices", async () => {
    const a = (await open(ALICE)).carnet, b = (await open(BOB)).carnet;
    await a.beginVisit("2026-10-10T10:00:00.000Z");
    expect(await b.beginVisit("2026-10-10T11:00:00.000Z")).toBe(null);
    const otherDevice = (await open(ALICE)).carnet;
    expect(await otherDevice.beginVisit("2026-10-11T09:00:00.000Z")).toBe("2026-10-10T10:00:00.000Z");
  });

  it("a failed write still returns the previous visit", async () => {
    const a = (await open(ALICE)).carnet;
    await a.beginVisit("2026-10-10T10:00:00.000Z");
    server.failNext("upsert");
    expect(await a.beginVisit("2026-10-11T10:00:00.000Z")).toBe("2026-10-10T10:00:00.000Z");
  });
});

describe("review days", () => {
  it("records each day once, only for me", async () => {
    const a = (await open(ALICE)).carnet, b = (await open(BOB)).carnet;
    await a.markReviewDay("2026-10-10");
    await a.markReviewDay("2026-10-11");
    await a.markReviewDay("2026-10-11");
    await b.markReviewDay("2026-10-11");
    await tick();
    expect(a.state.review_days.map(d => d.day).sort()).toEqual(["2026-10-10", "2026-10-11"]);
    expect(server.tables.review_days).toHaveLength(3);
  });

  it("a failed write is not fatal", async () => {
    const a = (await open(ALICE)).carnet;
    server.failNext("upsert");
    expect(await a.markReviewDay("2026-10-11")).toEqual({ ok: false, reason: "network" });
  });
});

describe("pages : blocs et positions", () => {
  let a, b, lesson;
  beforeEach(async () => {
    a = (await open(ALICE)).carnet;
    b = (await open(BOB)).carnet;
    lesson = (await a.saveLesson(null, { title: "Salutations" })).value;
  });
  const order = c => pageItemsOf(c).map(i => i.kind === "block" ? `b:${i.item.body}` : `e:${i.item.word}`);
  const pageItemsOf = c => c.pageOf(lesson.id);

  it("new Entrées go to the end of their Leçon's page", async () => {
    await a.saveBlock(null, { lesson_id: lesson.id, type: "title", body: "Le matin" });
    await a.saveEntry(null, draft(lesson.id, { word: "mbote" }));
    await a.saveEntry(null, draft(lesson.id, { word: "kwaheri" }));
    expect(order(a)).toEqual(["b:Le matin", "e:mbote", "e:kwaheri"]);
  });

  it("inserts a block at a given position, seen by the other Membre", async () => {
    await a.saveEntry(null, draft(lesson.id, { word: "mbote" }));
    await a.saveEntry(null, draft(lesson.id, { word: "kwaheri" }));
    const [first, second] = a.pageOf(lesson.id);
    const r = await a.saveBlock(null, { lesson_id: lesson.id, type: "callout", body: "règle", color: "ocre", position: (first.item.position + second.item.position) / 2 });
    expect(r.ok).toBe(true);
    await tick();
    expect(order(b)).toEqual(["e:mbote", "b:règle", "e:kwaheri"]);
    expect(b.state.blocks[0]).toMatchObject({ type: "callout", color: "ocre", author_email: ALICE });
  });

  it("edits and deletes a block", async () => {
    const { value: blk } = await a.saveBlock(null, { lesson_id: lesson.id, type: "text", body: "brouillon" });
    await b.saveBlock(blk, { body: "propre" });
    await tick();
    expect(a.state.blocks[0].body).toBe("propre");
    expect(await a.deleteBlock(blk)).toEqual({ ok: true });
    await tick();
    expect(b.state.blocks).toEqual([]);
  });

  it("refuses an unknown block type", async () => {
    expect(await a.saveBlock(null, { lesson_id: lesson.id, type: "video", body: "x" })).toEqual({ ok: false, reason: "invalid" });
  });

  it("moves a block or an Entrée up and down the page", async () => {
    await a.saveBlock(null, { lesson_id: lesson.id, type: "text", body: "A" });
    await a.saveEntry(null, draft(lesson.id, { word: "mbote" }));
    await a.saveBlock(null, { lesson_id: lesson.id, type: "text", body: "C" });
    const items = a.pageOf(lesson.id);
    expect((await a.move(items[2], "up")).ok).toBe(true);
    expect(order(a)).toEqual(["b:A", "b:C", "e:mbote"]);
    await a.move(a.pageOf(lesson.id)[0], "down");
    expect(order(a)).toEqual(["b:C", "b:A", "e:mbote"]);
    expect((await a.move(a.pageOf(lesson.id)[0], "up")).ok).toBe(true);   // déjà en haut : rien à faire
    expect(order(a)).toEqual(["b:C", "b:A", "e:mbote"]);
  });

  it("an Entrée moved to another Leçon goes to the end of that page", async () => {
    const other = (await a.saveLesson(null, { title: "Famille" })).value;
    await a.saveEntry(null, draft(other.id, { word: "mama" }));
    const { value: e } = await a.saveEntry(null, draft(lesson.id, { word: "baba" }));
    await a.saveEntry(e, draft(other.id, { word: "baba" }));
    expect(a.pageOf(other.id).map(i => i.item.word)).toEqual(["mama", "baba"]);
  });

  it("deleting the Leçon removes its blocks", async () => {
    await a.saveBlock(null, { lesson_id: lesson.id, type: "text", body: "x" });
    await a.deleteLesson(lesson);
    expect(a.state.blocks).toEqual([]);
    expect(server.tables.blocks).toEqual([]);
  });
});
