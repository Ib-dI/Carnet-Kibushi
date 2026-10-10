// Adaptateur de production : db et storage du Carnet sur Supabase.

const BUCKET = "media";
const REALTIME_TABLES = ["carnet", "lessons", "entries"];

const check = ({ data, error }) => { if (error) throw error; return data; };

export function createSupabaseAdapter(supabase) {
  const db = {
    list: async table => check(await supabase.from(table).select("*")),
    insert: async (table, row) => check(await supabase.from(table).insert(row).select().single()),
    update: async (table, id, patch) => check(await supabase.from(table).update(patch).eq("id", id).select().single()),
    remove: async (table, id) => { check(await supabase.from(table).delete().eq("id", id)); },
    subscribe(onEvent, onStatus) {
      const channel = supabase.channel("carnet");
      REALTIME_TABLES.forEach(table => channel.on("postgres_changes", { event: "*", schema: "public", table }, p =>
        onEvent({ table, type: p.eventType, row: p.eventType === "DELETE" ? p.old : p.new })));
      channel.subscribe(status => onStatus(status));
      return () => supabase.removeChannel(channel);
    },
  };
  const storage = {
    upload: async (path, blob, contentType) => { check(await supabase.storage.from(BUCKET).upload(path, blob, { contentType, upsert: false })); },
    remove: async paths => { check(await supabase.storage.from(BUCKET).remove(paths)); },
  };
  return { db, storage };
}
