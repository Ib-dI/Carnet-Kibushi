// Adaptateur en mémoire : un faux Supabase partagé, pour les tests.
// Un même serveur peut servir plusieurs Membres connectés en même temps.

// Tables dont chaque Membre ne voit que ses propres lignes (RLS), et colonne qui porte le Membre.
const OWNED = { progress: "member_email" };
// Suppressions en cascade (on delete cascade côté base) : table → [table enfant, colonne de lien].
const CHILDREN = { lessons: [["entries", "lesson_id"]], entries: [["progress", "entry_id"]] };

export function createMemoryServer({ members = [], langue = "" } = {}) {
  const tables = {
    members: members.map(m => ({ ...m })),
    carnet: [{ id: 1, langue }],
    lessons: [],
    entries: [],
    progress: [],
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
  const same = (a, b) => (a || "").toLowerCase() === (b || "").toLowerCase();
  const isMember = email => tables.members.some(m => same(m.email, email));
  const visible = (table, row, email) => !OWNED[table] || same(row[OWNED[table]], email);
  // Le temps réel respecte RLS : une ligne privée ne part qu'à son Membre.
  const broadcast = (change, owner) => subscribers.forEach(s =>
    s.connected && (!owner || same(s.email, owner)) && s.onEvent(structuredClone(change)));
  const now = () => new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)).toISOString();

  function removeRow(table, row) {
    for (const [child, key] of CHILDREN[table] || []) {
      tables[child].filter(r => r[key] === row.id).forEach(r => removeRow(child, r));
    }
    tables[table] = tables[table].filter(r => r !== row);
    broadcast({ table, type: "DELETE", row: { id: row.id } }, OWNED[table] && row[OWNED[table]]);
  }

  function connect(email) {
    const guard = () => { if (!isMember(email)) throw new Error("RLS"); };
    const stamp = (table, row) => {
      const saved = { id: `${table}-${++seq}`, created_at: now(), ...row };
      if (OWNED[table]) saved[OWNED[table]] = email;
      if (table === "entries") { saved.author_email = email; saved.updated_at = saved.created_at; }
      return saved;
    };
    const db = {
      async list(table) {
        fail("list");
        return isMember(email) ? structuredClone(tables[table].filter(r => visible(table, r, email))) : [];
      },
      async insert(table, row) {
        fail("insert"); guard();
        const saved = stamp(table, row);
        tables[table].push(saved);
        broadcast({ table, type: "INSERT", row: saved }, OWNED[table] && email);
        return structuredClone(saved);
      },
      async update(table, id, patch) {
        fail("update"); guard();
        const row = tables[table].find(r => r.id === id && visible(table, r, email));
        if (!row) throw new Error("introuvable");
        Object.assign(row, patch);
        broadcast({ table, type: "UPDATE", row: { ...row } }, OWNED[table] && email);
        return structuredClone(row);
      },
      // Insère ou met à jour la ligne qui a les mêmes valeurs pour `keys` (le Membre est ajouté d'office).
      async upsert(table, row, keys) {
        fail("upsert"); guard();
        const full = OWNED[table] ? { ...row, [OWNED[table]]: email } : row;
        const existing = tables[table].find(r => keys.every(k => r[k] === full[k]));
        if (!existing) return db.insert(table, row);
        Object.assign(existing, row);
        broadcast({ table, type: "UPDATE", row: { ...existing } }, OWNED[table] && email);
        return structuredClone(existing);
      },
      async remove(table, id) {
        fail("remove"); guard();
        const row = tables[table].find(r => r.id === id && visible(table, r, email));
        if (row) removeRow(table, row);
      },
      subscribe(onEvent, onStatus) {
        const sub = { email, onEvent, onStatus, connected: true };
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
    // Fait échouer les `times` prochains appels à `op` (list, insert, update, upsert, remove, upload, storageRemove),
    // après en avoir laissé passer `skip`.
    failNext(op, times = 1, { skip = 0 } = {}) { failures.set(op, { times, skip }); },
    // Coupe le temps réel : les changements faits pendant la coupure ne sont pas rejoués.
    disconnect() { subscribers.forEach(s => { s.connected = false; s.onStatus("CHANNEL_ERROR"); }); },
    reconnect() { subscribers.forEach(s => { s.connected = true; s.onStatus("SUBSCRIBED"); }); },
  };
}
