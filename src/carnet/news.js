// Ce qui est nouveau pour un Membre depuis sa dernière visite : les Entrées et les Commentaires
// ajoutés par quelqu'un d'autre. `since` vaut null à la toute première visite : rien n'est « nouveau ».

const same = (a, b) => (a || "").toLowerCase() === (b || "").toLowerCase();
const after = (t, since) => Date.parse(t) > Date.parse(since);

export function news({ entries, comments }, me, since) {
  const fresh = { entries: new Set(), comments: new Map() };
  if (!since) return fresh;
  for (const e of entries) {
    if (!same(e.author_email, me) && after(e.created_at, since)) fresh.entries.add(e.id);
  }
  for (const c of comments) {
    if (!same(c.author_email, me) && after(c.created_at, since)) fresh.comments.set(c.entry_id, (fresh.comments.get(c.entry_id) || 0) + 1);
  }
  return fresh;
}
