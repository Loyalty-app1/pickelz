-- ============================================================
--  Pickel'z — schéma Supabase (Postgres)
--  Tables normalisées · temps réel · RLS · index de perf
--  À exécuter dans : Supabase → SQL Editor → New query → Run
--  Ré-exécutable sans casse (idempotent).
-- ============================================================

-- ---------- 1. CLIENTS --------------------------------------
create table if not exists public.customers (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,                 -- code de connexion CF-XXXX (indexé par la contrainte unique)
  name         text not null,
  nickname     text not null,
  phone        text not null,
  instagram    text not null default '',
  promo_opt_in boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------- 2. VISITES --------------------------------------
-- 1 ligne par tampon (remplace le tableau JSON du localStorage).
-- Le "parcours du mois" se dérive de created_at, aucun reset stocké.
create table if not exists public.visits (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  type         text not null check (type in ('instagram','google')),
  server_code  text,
  created_at   timestamptz not null default now()
);

-- ---------- 3. RÉCOMPENSES ----------------------------------
create table if not exists public.rewards (
  id          uuid primary key default gen_random_uuid(),
  visit       int  not null check (visit between 1 and 100),
  label       text not null,
  detail      text not null default '',
  kind        text not null default 'discount' check (kind in ('discount','treat')),
  capped      boolean not null default false,
  active_from date,
  active_to   date,
  created_at  timestamptz not null default now()
);

-- ---------- 4. TITRES (cascade) -----------------------------
create table if not exists public.titles (
  id          uuid primary key default gen_random_uuid(),
  min_visits  int  not null unique check (min_visits >= 0),
  label       text not null
);

-- ---------- 5. PARAMÈTRES (singleton) -----------------------
-- Une seule ligne (id = true) : la taille de carte choisie par l'admin.
create table if not exists public.settings (
  id         boolean primary key default true check (id),
  card_size  int not null default 50 check (card_size between 5 and 100 and card_size % 5 = 0),
  updated_at timestamptz not null default now()
);

-- ---------- INDEX de performance ----------------------------
-- Les visites sont la seule grosse table : on l'indexe pour le compte
-- mensuel par client, l'historique récent, et les agrégats globaux.
create index if not exists visits_created_idx          on public.visits (created_at);
create index if not exists visits_customer_created_idx on public.visits (customer_id, created_at desc);
-- (rewards / titles / settings sont minuscules → aucun index nécessaire)

-- ---------- DONNÉES PAR DÉFAUT ------------------------------
insert into public.settings (id, card_size)
values (true, 50)
on conflict (id) do nothing;

-- Récompenses par défaut (seed unique : ne s'insère que si la table est vide)
insert into public.rewards (visit, label, detail, kind, capped)
select * from (values
  (5,  '10% de réduction',      'Plafonnée à 10 DT',                  'discount', true),
  (10, 'Soda offert',           'La boisson fraîche de votre choix',  'treat',    false),
  (15, '20% de réduction',      'Plafonnée à 10 DT',                  'discount', true),
  (20, 'Crêpe Nutella offerte', 'La classique, généreusement garnie', 'treat',    false),
  (27, '10% de réduction',      'Sans plafond',                       'discount', false),
  (33, '20% de réduction',      'Sans plafond',                       'discount', false),
  (40, '40% de réduction',      'Sans plafond',                       'discount', false),
  (50, 'Milkshake Oreo offert', 'Le boss final, bien mérité',         'treat',    false)
) as v(visit, label, detail, kind, capped)
where not exists (select 1 from public.rewards);

insert into public.titles (min_visits, label)
values
  (0,  'Petite Faim'),
  (10, 'Habitué du Comptoir'),
  (20, 'Grand Croqueur'),
  (35, 'Maître du Burger'),
  (50, 'Légende Pickel''z')
on conflict (min_visits) do nothing;

-- ---------- TEMPS RÉEL --------------------------------------
-- Ajoute chaque table à la publication realtime (ignore si déjà présente).
do $$
declare t text;
begin
  foreach t in array array['customers','visits','rewards','titles','settings'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- SÉCURITÉ (RLS) ----------------------------------
-- L'app est 100% côté client avec la clé anon (publique). RLS est activé
-- partout ; les politiques ci-dessous ouvrent exactement les opérations que
-- l'UI déclenche. ⚠️ Ce n'est PAS une frontière de sécurité tant qu'il n'y a
-- pas d'auth (voir la note "durcissement" plus bas).
alter table public.customers enable row level security;
alter table public.visits    enable row level security;
alter table public.rewards   enable row level security;
alter table public.titles    enable row level security;
alter table public.settings  enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete
  on public.customers, public.visits, public.rewards, public.titles, public.settings
  to anon, authenticated;

-- Lecture publique (l'app doit tout lire pour s'afficher)
drop policy if exists p_read on public.customers;
drop policy if exists p_read on public.visits;
drop policy if exists p_read on public.rewards;
drop policy if exists p_read on public.titles;
drop policy if exists p_read on public.settings;
create policy p_read on public.customers for select using (true);
create policy p_read on public.visits    for select using (true);
create policy p_read on public.rewards    for select using (true);
create policy p_read on public.titles     for select using (true);
create policy p_read on public.settings   for select using (true);

-- Écritures du parcours client : création de carte + tampons
drop policy if exists p_write on public.customers;
drop policy if exists p_write on public.visits;
create policy p_write on public.customers for all using (true) with check (true);
create policy p_write on public.visits    for all using (true) with check (true);

-- Écritures admin (récompenses / titres / taille de carte)
drop policy if exists p_admin on public.rewards;
drop policy if exists p_admin on public.titles;
drop policy if exists p_admin on public.settings;
create policy p_admin on public.rewards  for all using (true) with check (true);
create policy p_admin on public.titles   for all using (true) with check (true);
create policy p_admin on public.settings for all using (true) with check (true);
