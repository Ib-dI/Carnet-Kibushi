// Navigation par l'adresse : le bouton retour du téléphone et les liens marchent.
// « #/ » = sommaire des Leçons, « #/lecon/<id> » = la page d'une Leçon, « #/lecon/<id>/<bloc> » = à un bloc.

export function parseRoute(hash) {
  const m = /^#\/lecon\/([^/]+)(?:\/(.+))?$/.exec(hash || "");
  if (!m) return { view: "home" };
  return m[2] ? { view: "lesson", id: decodeURIComponent(m[1]), at: decodeURIComponent(m[2]) } : { view: "lesson", id: decodeURIComponent(m[1]) };
}

export const routeHash = r => r.view !== "lesson" ? "#/"
  : `#/lecon/${encodeURIComponent(r.id)}${r.at ? `/${encodeURIComponent(r.at)}` : ""}`;

export const currentRoute = () => parseRoute(location.hash);
export const go = r => { location.hash = routeHash(r); };
