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
