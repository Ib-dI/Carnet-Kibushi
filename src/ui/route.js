// Navigation par l'adresse : le bouton retour du téléphone et les liens marchent.
// « #/ » = sommaire des Leçons, « #/lecon/<id> » = la page d'une Leçon.

export function parseRoute(hash) {
  const m = /^#\/lecon\/(.+)$/.exec(hash || "");
  return m ? { view: "lesson", id: decodeURIComponent(m[1]) } : { view: "home" };
}

export const routeHash = r => r.view === "lesson" ? `#/lecon/${encodeURIComponent(r.id)}` : "#/";

export const currentRoute = () => parseRoute(location.hash);
export const go = r => { location.hash = routeHash(r); };
