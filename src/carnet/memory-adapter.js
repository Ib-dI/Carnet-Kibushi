// Adaptateur en mémoire : un faux Supabase partagé, pour les tests.
// Un même serveur peut servir plusieurs Membres connectés en même temps.

export function createMemoryServer({ members = [], langue = "" } = {}) {
  const tables = {
    members: members.map(m => ({ ...m })),
    carnet: [{ id: 1, langue }],
    lessons: [],
    entries: [],
  };
  const files = new Map();
  const subscribers = new Set();
  const failures = new Map();
  let seq = 0, clock = 0;

  const fail = op => {
    const f = failures.get(op);
    if (!f || !f.times) return;
    if (f.skip) { f.skip--; return; }
    f.times--;
    throw new Error(`échec simulé : ${op}`);
  };
  const broadcast = change => subscribers.forEach(s => s.connected && s.onEvent(structuredClone(change)));
  const isMember = email => tables.members.some(m => m.email.toLowerCase() === (email || "").toLowerCase());

  function connect(email) {
    const guard = () => { if (!isMember(email)) throw new Error("RLS"); };
    const db = {
      async list(table) {
        fail("list");
        return isMember(email) ? structuredClone(tables[table]) : [];
      },
      async insert(table, row) {
        fail("insert"); guard();
        const now = new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)).toISOString();
        const saved = { id: `${table}-${++seq}`, created_at: now, ...row };
        if (table === "entries") { saved.author_email = email; saved.updated_at = now; }
        tables[table].push(saved);
        broadcast({ table, type: "INSERT", row: saved });
        return structuredClone(saved);
      },
      async update(table, id, patch) {
        fail("update"); guard();
        const row = tables[table].find(r => r.id === id);
        if (!row) throw new Error("introuvable");
        Object.assign(row, patch);
        broadcast({ table, type: "UPDATE", row: { ...row } });
        return structuredClone(row);
      },
      async remove(table, id) {
        fail("remove"); guard();
        tables[table] = tables[table].filter(r => r.id !== id);
        if (table === "lessons") {
          const gone = tables.entries.filter(e => e.lesson_id === id);
          tables.entries = tables.entries.filter(e => e.lesson_id !== id);
          gone.forEach(e => broadcast({ table: "entries", type: "DELETE", row: { id: e.id } }));
        }
        broadcast({ table, type: "DELETE", row: { id } });
      },
      subscribe(onEvent, onStatus) {
        const sub = { onEvent, onStatus, connected: true };
        subscribers.add(sub);
        queueMicrotask(() => sub.connected && onStatus("SUBSCRIBED"));
        return () => subscribers.delete(sub);
      },
    };
    const storage = {
      async upload(path, blob) { fail("upload"); guard(); files.set(path, blob); },
      async remove(paths) { fail("storageRemove"); paths.forEach(p => files.delete(p)); },
    };
    return { db, storage };
  }

  return {
    connect,
    tables,
    files,
    // Fait échouer les `times` prochains appels à `op` (list, insert, update, remove, upload, storageRemove),
    // après en avoir laissé passer `skip`.
    failNext(op, times = 1, { skip = 0 } = {}) { failures.set(op, { times, skip }); },
    // Coupe le temps réel : les changements faits pendant la coupure ne sont pas rejoués.
    disconnect() { subscribers.forEach(s => { s.connected = false; s.onStatus("CHANNEL_ERROR"); }); },
    reconnect() { subscribers.forEach(s => { s.connected = true; s.onStatus("SUBSCRIBED"); }); },
  };
}
