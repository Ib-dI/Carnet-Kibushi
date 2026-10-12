// Registre des tables du Carnet : ce que l'app sait de chaque table, écrit une seule fois.
// C'est le reflet de supabase/schema.sql (vérifié par tables.test.js). Le lisent : le réducteur,
// le chargement du Carnet, l'adaptateur Supabase (temps réel) et l'adaptateur en mémoire (tests).
//
//   kind     "list" (lignes repérées par id), "single" (une ligne : carnet) ou "static" (chargée une fois : members)
//   parent   [table, colonne] : la ligne part avec son parent (on delete cascade)
//   owner    colonne du Membre propriétaire : seul lui peut écrire la ligne
//   private  les autres Membres ne voient même pas la ligne (RLS)
//   realtime suivie en temps réel
//   sort     "position" : tri par position, puis date
//   author   colonne remplie avec le Membre qui crée la ligne (sans en faire un propriétaire)

export const TABLES = {
  carnet: { kind: "single", realtime: true },
  members: { kind: "static" },
  lessons: { kind: "list", realtime: true, sort: "position" },
  entries: { kind: "list", parent: ["lessons", "lesson_id"], realtime: true, author: "author_email" },
  blocks: { kind: "list", parent: ["lessons", "lesson_id"], realtime: true, author: "author_email" },
  progress: { kind: "list", parent: ["entries", "entry_id"], owner: "member_email", private: true, realtime: true },
  attempts: { kind: "list", parent: ["entries", "entry_id"], owner: "member_email", realtime: true },
  comments: { kind: "list", parent: ["entries", "entry_id"], owner: "author_email", realtime: true },
  visits: { kind: "list", owner: "member_email", private: true },
  review_days: { kind: "list", owner: "member_email", private: true },
};

export const tableNames = Object.keys(TABLES);
export const listTables = tableNames.filter(t => TABLES[t].kind === "list");
export const realtimeTables = tableNames.filter(t => TABLES[t].realtime);

// [[table enfant, colonne de lien]] : ce qui part avec une ligne de `table`.
export const childrenOf = table => tableNames.filter(t => TABLES[t].parent?.[0] === table).map(t => [t, TABLES[t].parent[1]]);
export const ownerOf = table => TABLES[table]?.owner || null;
export const isPrivate = table => Boolean(TABLES[table]?.private);
export const authorOf = table => TABLES[table]?.author || null;
export const sortOf = table => TABLES[table]?.sort || null;
