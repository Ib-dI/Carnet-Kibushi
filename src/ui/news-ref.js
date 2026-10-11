// Badge « nouveau » : la date de la visite précédente, fixée au début de la visite (main.js).
import { carnet } from "./carnet-ref.js";
import { news } from "../carnet/news.js";

let since = null;
export const setSince = s => { since = s; };
export const currentNews = () => news(carnet.state, carnet.me, since);
