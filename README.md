# Carnet de langue partagé

Un carnet en ligne, partagé à deux, pour apprendre une langue orale : mots écrits à l'oreille, prononciation, traduction, photo et surtout vocaux, rangés par leçon, avec un mode révision.

Vite + JavaScript vanilla, Supabase (auth par lien magique, Postgres, stockage, temps réel).

## Mise en route

1. Créer un projet gratuit sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, coller `supabase/schema.sql` en remplaçant les deux adresses e-mail (et les prénoms affichés), puis exécuter.
3. Dans **Authentication → URL Configuration**, ajouter l'adresse du site (et `http://localhost:5173` pour les tests) dans les URL de redirection.
4. Copier `.env.example` en `.env` et y mettre l'URL du projet et sa clé **publishable** (**Project Settings → API Keys** ; sur un ancien projet, la clé `anon`). Jamais la clé `secret` / `service_role`.
5. `npm install` puis `npm run dev`.
6. Déployer sur Netlify ou Vercel (build `npm run build`, dossier `dist`, mêmes variables d’environnement `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`).
7. Envoyer le lien à la professeure : elle saisit son e-mail et reçoit son lien de connexion.

Ajouter une personne plus tard : une ligne de plus dans la table `members` (**Table Editor → members**).

## Bon à savoir

- Le schéma donne explicitement l'accès aux tables (`grant … to authenticated`) : depuis 2026, Supabase n'expose plus automatiquement les nouvelles tables à l'API. Les visiteurs non connectés (`anon`) n'ont accès à rien.
- Sur l'offre gratuite, les e-mails de connexion utilisent le modèle Supabase par défaut (en anglais) et l'envoi est limité à quelques e-mails par heure. Pour un e-mail en français, configurer un SMTP (Resend, Brevo…) dans **Authentication → Emails**.

- Le micro ne fonctionne qu'en **HTTPS** (ou sur `localhost`). Sur le site déployé, c'est automatique.
- Sur iPhone, le navigateur demande l'autorisation du micro au premier enregistrement.
- Les vocaux WhatsApp (`.opus`) s'importent avec « Choisir un fichier ». Les anciens iPhone (iOS < 17) ne savent pas toujours les lire : dans ce cas, préférer enregistrer directement dans le carnet.
- Pour installer le carnet comme une app : dans le navigateur du téléphone, « Ajouter à l'écran d'accueil ».

## Arborescence

```
index.html              page unique
public/                 manifest et icônes
supabase/schema.sql     tables, sécurité (RLS), temps réel, stockage
src/main.js             démarrage, routage connexion / carnet
src/state.js            état en mémoire + abonnements temps réel
src/lib/                client Supabase, médias, enregistreur, lecteur audio
src/ui/                 en-tête, grille de leçons, fenêtres, révision, connexion
src/styles/             tokens (couleurs, polices) et composants
```
