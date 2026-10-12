// Navigation par l'adresse : le bouton retour du téléphone et les liens marchent.
// « #/ » sommaire des Leçons · « #/lecon/<id>[/<bloc>] » page d'une Leçon (à un bloc)
// « #/reviser[/<leçon>] » Révision (de toutes les Leçons, ou d'une seule) · « #/progres » Progrès.

const dec = decodeURIComponent, enc = encodeURIComponent;

export function parseRoute(hash) {
  const h = hash || "";
  let m;
  if ((m = /^#\/lecon\/([^/]+)(?:\/(.+))?$/.exec(h))) return m[2] ? { view: "lesson", id: dec(m[1]), at: dec(m[2]) } : { view: "lesson", id: dec(m[1]) };
  if ((m = /^#\/reviser(?:\/(.+))?$/.exec(h))) return m[1] ? { view: "review", lesson: dec(m[1]) } : { view: "review" };
  if (h === "#/progres") return { view: "progress" };
  return { view: "home" };
}

export function routeHash(r) {
  if (r.view === "lesson") return `#/lecon/${enc(r.id)}${r.at ? `/${enc(r.at)}` : ""}`;
  if (r.view === "review") return `#/reviser${r.lesson ? `/${enc(r.lesson)}` : ""}`;
  if (r.view === "progress") return "#/progres";
  return "#/";
}

// Onglet de la barre de navigation auquel appartient une vue.
export const tabOf = r => r.view === "review" ? "review" : r.view === "progress" ? "progress" : "lessons";

export const currentRoute = () => parseRoute(location.hash);
export const go = r => { location.hash = routeHash(r); };
