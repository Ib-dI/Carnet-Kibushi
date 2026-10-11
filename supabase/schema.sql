-- Carnet de langue partagé — à exécuter une fois dans Supabase → SQL Editor.
-- Les adresses autorisées sont dans la table members, plus bas.

-- Extensions
create extension if not exists pgcrypto;

-- Schéma privé (non exposé à l'API) pour les fonctions internes
create schema if not exists private;

-- Membres autorisés
create table public.members (
  email text primary key,
  display_name text not null
);
insert into public.members (email, display_name) values
  ('ton-adresse@exemple.fr', 'Ton prénom');
-- Pour ajouter la professeure plus tard (SQL Editor) :
-- insert into public.members (email, display_name) values ('adresse@exemple.fr', 'Prénom');

-- Vrai si la personne connectée figure dans members.
-- security definer : nécessaire pour lire members sans boucler sur sa propre politique RLS.
-- Rangée dans le schéma privé pour ne pas être appelable comme point d'API.
create or replace function private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m
                 where lower(m.email) = lower(auth.jwt() ->> 'email'));
$$;
revoke all on function private.is_member() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_member() to authenticated;

-- Carnet (une seule ligne)
create table public.carnet (
  id int primary key default 1 check (id = 1),
  langue text default ''
);
insert into public.carnet (id) values (1);

-- Leçons
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  emoji text default '',
  color text not null default 'canard'
    check (color in ('brique','canard','ocre','prune','indigo','olive')),
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Entrées
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  type text not null default 'mot' check (type in ('mot','phrase','expression','conseil')),
  word text default '',
  pron text default '',
  translation text default '',
  note text default '',
  emoji text default '',
  text_color text default '' check (text_color in ('','brique','canard','ocre','prune','indigo','olive')),
  image_path text,
  audio_path text,
  author_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.entries (lesson_id, created_at);

-- L'autrice est toujours la personne connectée à la création, et ne change plus ensuite.
create or replace function private.entries_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.author_email = auth.jwt() ->> 'email';
    new.created_at = now();
  else
    new.author_email = old.author_email;
    new.created_at = old.created_at;
  end if;
  new.updated_at = now();
  return new;
end $$;
create trigger entries_stamp before insert or update on public.entries
  for each row execute function private.entries_stamp();

-- Accès à l'API : seulement les personnes connectées (jamais anon).
-- Depuis 2026, les nouveaux projets n'exposent plus les tables sans grant explicite.
revoke all on public.members, public.carnet, public.lessons, public.entries from anon;
grant select on public.members to authenticated;
grant select, update on public.carnet to authenticated;
grant select, insert, update, delete on public.lessons, public.entries to authenticated;

-- Sécurité ligne par ligne : seules les membres lisent et écrivent
alter table public.members enable row level security;
alter table public.carnet  enable row level security;
alter table public.lessons enable row level security;
alter table public.entries enable row level security;

create policy "membres lisent membres" on public.members for select to authenticated
  using ((select private.is_member()));
create policy "membres lisent carnet" on public.carnet for select to authenticated
  using ((select private.is_member()));
create policy "membres modifient carnet" on public.carnet for update to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));
create policy "membres lessons" on public.lessons for all to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));
create policy "membres entries" on public.entries for all to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));

-- Temps réel
alter publication supabase_realtime add table public.carnet, public.lessons, public.entries;

-- Stockage : bucket privé "media" (images et vocaux, 10 Mo max par fichier)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('media', 'media', false, 10485760, array['image/*', 'audio/*'])
  on conflict (id) do nothing;

create policy "membres lisent media" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (select private.is_member()));
create policy "membres ajoutent media" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (select private.is_member()));
create policy "membres modifient media" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (select private.is_member()))
  with check (bucket_id = 'media' and (select private.is_member()));
create policy "membres suppriment media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (select private.is_member()));

-- Connexion : seules les adresses de members peuvent créer un compte.
-- À activer ensuite dans Authentication → Hooks → « Before User Created » → Postgres → public.hook_members_only.
create or replace function public.hook_members_only(event jsonb)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (select 1 from public.members m
             where lower(m.email) = lower(event->'user'->>'email')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Cette adresse n''a pas accès au carnet.'));
end $$;
revoke execute on function public.hook_members_only(jsonb) from public, anon, authenticated;
grant execute on function public.hook_members_only(jsonb) to supabase_auth_admin;

-- Révision du jour : la Boîte de chaque Carte, par Membre et par Sens de révision.
create table public.progress (
  id uuid primary key default gen_random_uuid(),
  member_email text not null default (auth.jwt() ->> 'email'),
  entry_id uuid not null references public.entries(id) on delete cascade,
  direction text not null check (direction in ('fr', 'lg')),
  box smallint not null default 1 check (box between 1 and 5),
  due date not null,
  lapses integer not null default 0 check (lapses >= 0),
  introduced_on date not null,
  updated_at timestamptz not null default now(),
  unique (member_email, entry_id, direction)
);
create index progress_entry_id_idx on public.progress (entry_id);
revoke all on public.progress from anon;
grant select, insert, update, delete on public.progress to authenticated;
alter table public.progress enable row level security;
-- Chaque Membre ne voit et n'écrit que ses propres progrès.
create policy "chacun ses progrès" on public.progress for all to authenticated
  using ((select private.is_member()) and member_email = (select auth.jwt() ->> 'email'))
  with check ((select private.is_member()) and member_email = (select auth.jwt() ->> 'email'));
alter publication supabase_realtime add table public.progress;

-- Essais : l'enregistrement d'un Membre qui imite le Vocal d'une Entrée (un par Membre et par Entrée).
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  member_email text not null default (auth.jwt() ->> 'email'),
  audio_path text not null,
  created_at timestamptz not null default now(),
  unique (entry_id, member_email)
);
revoke all on public.attempts from anon;
grant select, insert, update, delete on public.attempts to authenticated;
alter table public.attempts enable row level security;
-- Tous les Membres entendent les Essais ; chacun n'écrit que les siens.
create policy "membres lisent essais" on public.attempts for select to authenticated
  using ((select private.is_member()));
create policy "chacun ajoute ses essais" on public.attempts for insert to authenticated
  with check ((select private.is_member()) and member_email = (select auth.jwt() ->> 'email'));
create policy "chacun modifie ses essais" on public.attempts for update to authenticated
  using ((select private.is_member()) and member_email = (select auth.jwt() ->> 'email'))
  with check ((select private.is_member()) and member_email = (select auth.jwt() ->> 'email'));
create policy "chacun supprime ses essais" on public.attempts for delete to authenticated
  using ((select private.is_member()) and member_email = (select auth.jwt() ->> 'email'));
alter publication supabase_realtime add table public.attempts;

-- Commentaires : messages courts signés sous une Entrée. On les supprime, on ne les modifie pas.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  author_email text not null default (auth.jwt() ->> 'email'),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_entry_id_idx on public.comments (entry_id, created_at);
revoke all on public.comments from anon;
grant select, insert, delete on public.comments to authenticated;
alter table public.comments enable row level security;
create policy "membres lisent commentaires" on public.comments for select to authenticated
  using ((select private.is_member()));
create policy "chacun écrit ses commentaires" on public.comments for insert to authenticated
  with check ((select private.is_member()) and author_email = (select auth.jwt() ->> 'email'));
create policy "chacun supprime ses commentaires" on public.comments for delete to authenticated
  using ((select private.is_member()) and author_email = (select auth.jwt() ->> 'email'));
alter publication supabase_realtime add table public.comments;

-- Dernière visite de chaque Membre (pour le badge « nouveau »), commune à ses appareils.
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  member_email text not null unique default (auth.jwt() ->> 'email'),
  seen_at timestamptz not null
);
revoke all on public.visits from anon;
grant select, insert, update on public.visits to authenticated;
alter table public.visits enable row level security;
create policy "chacun sa visite" on public.visits for all to authenticated
  using ((select private.is_member()) and member_email = (select auth.jwt() ->> 'email'))
  with check ((select private.is_member()) and member_email = (select auth.jwt() ->> 'email'));
