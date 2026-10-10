// Un Média (photo ou Vocal) pendant l'édition d'une Entrée : gardé, remplacé ou retiré.
// `change` est exactement ce qu'attend carnet.saveEntry pour ce Média.

export function createMediaSlot(path, { maxBytes = Infinity } = {}) {
  let blob = null, removed = false;   // removed : le Média d'origine ne doit plus être gardé

  return {
    replace(next) {
      if (next.size > maxBytes) return { ok: false, reason: "too-large" };
      blob = next; removed = true;
      return { ok: true };
    },
    clear() { blob = null; removed = true; },
    get shown() { return blob ? { blob } : path && !removed ? { path } : null; },
    get change() { return blob ? { replace: blob } : path && removed ? { remove: true } : { keep: true }; },
  };
}
