// Appui long (téléphone) ou clic droit (ordinateur) sur un élément : onLong(élément).
// Le « clic » qui suit un appui long est annulé, pour ne pas ouvrir le lien en plus du menu.
const DELAY = 500, SLOP = 10;   // ms avant déclenchement ; px de mouvement toléré (au-delà : on fait défiler)

export function onLongPress(el, onLong) {
  let timer = null, start = null, fired = false;
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.addEventListener("pointerdown", ev => {
    if (ev.button !== 0) return;
    fired = false; start = { x: ev.clientX, y: ev.clientY };
    cancel();
    timer = setTimeout(() => { fired = true; navigator.vibrate?.(12); onLong(el); }, DELAY);
  });
  el.addEventListener("pointermove", ev => {
    if (timer && start && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > SLOP) cancel();
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(t => el.addEventListener(t, cancel));
  el.addEventListener("click", ev => { if (fired) { ev.preventDefault(); ev.stopPropagation(); fired = false; } }, true);
  el.addEventListener("contextmenu", ev => {
    ev.preventDefault();
    cancel();
    if (!fired) onLong(el);   // clic droit, ou touche « menu » du clavier
    fired = false;
  });
}
