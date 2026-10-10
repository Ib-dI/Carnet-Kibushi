import { supabase } from "./lib/supabase.js";

export const state = { carnet: {}, lessons: [], entries: [], members: [], me: null, query: "" };
const listeners = new Set();
export const onChange = fn => (listeners.add(fn), () => listeners.delete(fn));
export const emit = () => listeners.forEach(fn => fn(state));

const byPosition = (a, b) => a.position - b.position || String(a.created_at).localeCompare(String(b.created_at));

export async function load() {
  const [c, l, e, m] = await Promise.all([
    supabase.from("carnet").select("*").eq("id", 1).single(),
    supabase.from("lessons").select("*").order("position"),
    supabase.from("entries").select("*").order("created_at"),
    supabase.from("members").select("*"),
  ]);
  const err = [c, l, e, m].find(r => r.error)?.error;
  if (err) throw err;
  state.carnet = c.data || {}; state.lessons = (l.data || []).sort(byPosition); state.entries = e.data || []; state.members = m.data || [];
  emit();
}

function apply(list, payload) {
  const { eventType, new: row, old } = payload;
  if (eventType === "DELETE") return list.filter(x => x.id !== old.id);
  const i = list.findIndex(x => x.id === row.id);
  if (i === -1) return [...list, row];
  const copy = list.slice(); copy[i] = row; return copy;
}

// Applique tout de suite une ligne renvoyée par une écriture (le temps réel confirmera ensuite).
export function applyLocal(table, row, eventType = "UPDATE") {
  const payload = { eventType, new: row, old: row };
  if (table === "lessons") {
    state.lessons = apply(state.lessons, payload).sort(byPosition);
    if (eventType === "DELETE") state.entries = state.entries.filter(e => e.lesson_id !== row.id);
  }
  if (table === "entries") state.entries = apply(state.entries, payload);
  if (table === "carnet") state.carnet = row;
  emit();
}

let subscribed = false;
export function subscribe() {
  if (subscribed) return; subscribed = true;
  supabase.channel("carnet")
    .on("postgres_changes", { event: "*", schema: "public", table: "lessons" }, p => {
      state.lessons = apply(state.lessons, p).sort(byPosition);
      if (p.eventType === "DELETE") state.entries = state.entries.filter(e => e.lesson_id !== p.old.id);
      emit(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, p => {
      state.entries = apply(state.entries, p); emit(); })
    .on("postgres_changes", { event: "*", schema: "public", table: "carnet" }, p => {
      state.carnet = p.new || state.carnet; emit(); })
    .subscribe();
}

export const authorName = email => {
  if (!email) return "";
  if (state.me && email.toLowerCase() === state.me.toLowerCase()) return "toi";
  return state.members.find(m => m.email.toLowerCase() === email.toLowerCase())?.display_name || "";
};

export const myName = () => state.members.find(m => m.email.toLowerCase() === (state.me || "").toLowerCase())?.display_name || state.me || "";

export const reviewable = e => e.type !== "conseil" && e.word && e.translation;
