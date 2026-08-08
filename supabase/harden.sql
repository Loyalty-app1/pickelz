-- ============================================================
--  Pickel'z — durcissement sécurité (sans auth, même mécanisme)
--  Tout accès sensible passe par des fonctions SECURITY DEFINER.
--  Le rôle anon ne peut plus lire/écrire customers/visits directement.
--  Les PIN (serveur + admin) vivent en base, plus dans le bundle JS.
-- ============================================================

-- ---------- Secrets serveur (PIN) ---------------------------
create table if not exists public.app_secrets (
  id          boolean primary key default true check (id),
  admin_pin   text not null default '0000',
  server_pins text[] not null default array['1111','2222','5555','7777']
);
insert into public.app_secrets (id) values (true) on conflict (id) do nothing;

-- ---------- Helpers internes (non exposés à anon) -----------
create or replace function public._gen_code(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare v_pref text; v_code text;
begin
  select upper(regexp_replace(string_agg(left(w, 1), '' order by ord), '[^A-Za-z]', '', 'g'))
    into v_pref
  from unnest(regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+')) with ordinality as t(w, ord);
  v_pref := left(coalesce(v_pref, ''), 3);
  if v_pref = '' then v_pref := 'X'; end if;
  loop
    v_code := v_pref || '-' || lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    exit when not exists (select 1 from customers c where c.code = v_code);
  end loop;
  return v_code;
end $$;

create or replace function public._customer_json(p_id uuid)
returns json language sql security definer set search_path = public as $$
  select json_build_object(
    'id', c.code, 'dbId', c.id, 'name', c.name, 'nickname', c.nickname,
    'phone', c.phone, 'instagram', c.instagram, 'promoOptIn', c.promo_opt_in,
    'history', coalesce((
      select json_agg(json_build_object(
               'id', v.id, 'date', v.created_at, 'type', v.type, 'serverCode', v.server_code)
             order by v.created_at)
      from visits v where v.customer_id = c.id), '[]'::json)
  ) from customers c where c.id = p_id;
$$;

create or replace function public._admin_ok(p_pin text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from app_secrets where admin_pin = p_pin);
$$;

-- ---------- RPC publiques / client --------------------------
create or replace function public.create_customer(
  p_name text, p_nickname text, p_phone text, p_instagram text, p_promo boolean)
returns json language plpgsql security definer set search_path = public as $$
declare newid uuid; v_code text;
begin
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'invalid_name'; end if;
  if length(btrim(coalesce(p_nickname, ''))) < 2 then raise exception 'invalid_nickname'; end if;
  if length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) not between 7 and 15
    then raise exception 'invalid_phone'; end if;
  v_code := _gen_code(p_name);
  insert into customers(code, name, nickname, phone, instagram, promo_opt_in)
    values (v_code, btrim(p_name), btrim(p_nickname), btrim(p_phone),
            btrim(coalesce(p_instagram, '')), coalesce(p_promo, false))
    returning id into newid;
  return _customer_json(newid);
end $$;

create or replace function public.login_customer(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select id into cid from customers where code = upper(btrim(coalesce(p_code, '')));
  if cid is null then return null; end if;
  return _customer_json(cid);
end $$;

create or replace function public.add_visit(p_code text, p_pin text, p_type text)
returns json language plpgsql security definer set search_path = public as $$
declare cid uuid; pins text[];
begin
  select server_pins into pins from app_secrets limit 1;
  if not (p_pin = any(pins)) then raise exception 'bad_pin'; end if;
  if p_type not in ('instagram', 'google') then raise exception 'bad_type'; end if;
  select id into cid from customers where code = upper(btrim(coalesce(p_code, '')));
  if cid is null then raise exception 'no_customer'; end if;
  insert into visits(customer_id, type, server_code) values (cid, p_type, p_pin);
  return _customer_json(cid);
end $$;

create or replace function public.update_customer(
  p_code text, p_name text, p_nickname text, p_phone text, p_instagram text, p_promo boolean)
returns json language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select id into cid from customers where code = upper(btrim(coalesce(p_code, '')));
  if cid is null then raise exception 'no_customer'; end if;
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'invalid_name'; end if;
  if length(btrim(coalesce(p_nickname, ''))) < 2 then raise exception 'invalid_nickname'; end if;
  if length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) not between 7 and 15
    then raise exception 'invalid_phone'; end if;
  update customers set
    name = btrim(p_name), nickname = btrim(p_nickname), phone = btrim(p_phone),
    instagram = btrim(coalesce(p_instagram, '')), promo_opt_in = coalesce(p_promo, false)
  where id = cid;
  return _customer_json(cid);
end $$;

-- Roulette : noms/surnoms des participants du mois (aucune donnée perso, aucun code)
create or replace function public.month_participants()
returns json language sql security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('name', c.name, 'nickname', c.nickname) order by c.name), '[]'::json)
  from customers c
  where exists (select 1 from visits v
                where v.customer_id = c.id
                  and date_trunc('month', v.created_at) = date_trunc('month', now()));
$$;

-- ---------- RPC admin (protégées par le PIN, vérifié en base) ----
create or replace function public.admin_snapshot(p_pin text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pin) then return null; end if;
  return json_build_object(
    'users', coalesce((select json_agg(_customer_json(c.id) order by c.name) from customers c), '[]'::json),
    'rewards', coalesce((select json_agg(json_build_object(
        'id', r.id, 'visit', r.visit, 'label', r.label, 'detail', r.detail,
        'kind', r.kind, 'capped', r.capped, 'activeFrom', r.active_from, 'activeTo', r.active_to)
      order by r.visit) from rewards r), '[]'::json),
    'titles', coalesce((select json_agg(json_build_object(
        'id', t.id, 'min', t.min_visits, 'label', t.label) order by t.min_visits) from titles t), '[]'::json),
    'cardSize', (select card_size from settings where id = true)
  );
end $$;

create or replace function public.admin_upsert_reward(
  p_pin text, p_id uuid, p_visit int, p_label text, p_detail text,
  p_kind text, p_capped boolean, p_active_from date, p_active_to date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pin) then raise exception 'forbidden'; end if;
  if p_id is null then
    insert into rewards(visit, label, detail, kind, capped, active_from, active_to)
      values (p_visit, p_label, coalesce(p_detail, ''), p_kind, coalesce(p_capped, false), p_active_from, p_active_to);
  else
    update rewards set visit = p_visit, label = p_label, detail = coalesce(p_detail, ''),
      kind = p_kind, capped = coalesce(p_capped, false), active_from = p_active_from, active_to = p_active_to
    where id = p_id;
  end if;
end $$;

create or replace function public.admin_delete_reward(p_pin text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pin) then raise exception 'forbidden'; end if;
  delete from rewards where id = p_id;
end $$;

create or replace function public.admin_save_titles(p_pin text, p_titles json)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pin) then raise exception 'forbidden'; end if;
  delete from titles where true;
  insert into titles(min_visits, label)
    select (e->>'min')::int, e->>'label' from json_array_elements(p_titles) as e;
end $$;

create or replace function public.admin_set_card_size(p_pin text, p_n int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pin) then raise exception 'forbidden'; end if;
  update settings set card_size = greatest(5, least(100, (round(p_n / 5.0) * 5)::int)), updated_at = now()
  where id = true;
end $$;

create or replace function public.admin_clear(p_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pin) then raise exception 'forbidden'; end if;
  delete from customers where true;
  delete from rewards where true;
  delete from titles where true;
  insert into rewards(visit, label, detail, kind, capped) values
    (5,  '10% de réduction',      'Plafonnée à 10 DT',                  'discount', true),
    (10, 'Soda offert',           'La boisson fraîche de votre choix',  'treat',    false),
    (15, '20% de réduction',      'Plafonnée à 10 DT',                  'discount', true),
    (20, 'Crêpe Nutella offerte', 'La classique, généreusement garnie', 'treat',    false),
    (27, '10% de réduction',      'Sans plafond',                       'discount', false),
    (33, '20% de réduction',      'Sans plafond',                       'discount', false),
    (40, '40% de réduction',      'Sans plafond',                       'discount', false),
    (50, 'Milkshake Oreo offert', 'Le boss final, bien mérité',         'treat',    false);
  insert into titles(min_visits, label) values
    (0, 'Petite Faim'), (10, 'Habitué du Comptoir'), (20, 'Grand Croqueur'),
    (35, 'Maître du Burger'), (50, 'Légende Pickel''z');
  update settings set card_size = 50 where id = true;
end $$;

create or replace function public.admin_seed(p_pin text)
returns void language plpgsql security definer set search_path = public as $$
declare
  names  text[] := array['Camille Moreau','Yassine Ben Ali','Emna Trabelsi','Louis Fontaine','Sarra Mansour','Karim Haddad','Nour Gharbi','Amine Jelassi','Léa Bouazizi','Omar Chennoufi','Ines Kallel','Hugo Bernard'];
  nicks  text[] := array['Cam','Yass','Emy','Lou','Sasa','Kaki','Nunu','Mimo','Léa','Oma','Nina','Hug'];
  instas text[] := array['camille.mr','yass.benali','emna_tbl','','sarra.mn','karim.hd','nour.gh','aminejl','lea.bzz','omar.chn','ines.kl',''];
  months int[]  := array[3,7,12,0,22,15,34,50,5,18,27,9];
  pasts  int[]  := array[4,10,6,14,20,8,25,30,2,12,16,5];
  i int; j int; cid uuid; back int;
begin
  if not _admin_ok(p_pin) then raise exception 'forbidden'; end if;
  for i in 1..array_length(names, 1) loop
    insert into customers(code, name, nickname, phone, instagram, promo_opt_in)
      values (_gen_code(names[i]), names[i], nicks[i],
              '+216 2' || (i - 1) || ' ' || (100 + i - 1) || ' ' || (200 + i - 1),
              instas[i], ((i - 1) % 3) <> 0)
      returning id into cid;
    for j in 1..pasts[i] loop
      back := 28 + floor(random() * 140)::int;
      insert into visits(customer_id, type, server_code, created_at)
        values (cid, case when random() < 0.55 then 'instagram' else 'google' end, '1111',
                now() - (back || ' days')::interval);
    end loop;
    for j in 1..months[i] loop
      back := floor(random() * greatest(extract(day from now())::int - 1, 1))::int;
      insert into visits(customer_id, type, server_code, created_at)
        values (cid, case when random() < 0.55 then 'instagram' else 'google' end, '2222',
                now() - (back || ' days')::interval);
    end loop;
  end loop;
end $$;

-- ---------- Verrouillage des accès directs ------------------
-- customers / visits / app_secrets : plus aucun accès direct anon.
revoke all on public.customers   from anon, authenticated;
revoke all on public.visits      from anon, authenticated;
revoke all on public.app_secrets from anon, authenticated;

-- config : lecture seule pour anon (réécrite par les RPC admin).
revoke insert, update, delete on public.rewards, public.titles, public.settings from anon, authenticated;
grant  select on public.rewards, public.titles, public.settings to anon, authenticated;

alter table public.app_secrets enable row level security;

-- Retire les anciennes politiques permissives
drop policy if exists p_read  on public.customers;
drop policy if exists p_write on public.customers;
drop policy if exists p_read  on public.visits;
drop policy if exists p_write on public.visits;
drop policy if exists p_admin on public.rewards;
drop policy if exists p_admin on public.titles;
drop policy if exists p_admin on public.settings;

-- config : lecture publique uniquement
drop policy if exists p_read on public.rewards;  create policy p_read on public.rewards  for select using (true);
drop policy if exists p_read on public.titles;   create policy p_read on public.titles   for select using (true);
drop policy if exists p_read on public.settings; create policy p_read on public.settings for select using (true);
-- customers / visits / app_secrets : RLS active, AUCUNE politique → aucun accès direct

-- Temps réel : uniquement la config (non sensible). On retire les tables PII.
do $$ begin alter publication supabase_realtime drop table public.customers; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime drop table public.visits;    exception when others then null; end $$;

-- Les helpers internes ne doivent PAS être appelables par anon
revoke execute on function public._gen_code(text)      from public;
revoke execute on function public._customer_json(uuid) from public;
revoke execute on function public._admin_ok(text)      from public;

-- Les RPC exposées (par défaut EXECUTE est donné à PUBLIC ; on l'assure pour anon)
grant execute on function public.create_customer(text,text,text,text,boolean) to anon, authenticated;
grant execute on function public.login_customer(text)                          to anon, authenticated;
grant execute on function public.add_visit(text,text,text)                     to anon, authenticated;
grant execute on function public.update_customer(text,text,text,text,text,boolean) to anon, authenticated;
grant execute on function public.month_participants()                          to anon, authenticated;
grant execute on function public.admin_snapshot(text)                          to anon, authenticated;
grant execute on function public.admin_upsert_reward(text,uuid,int,text,text,text,boolean,date,date) to anon, authenticated;
grant execute on function public.admin_delete_reward(text,uuid)                to anon, authenticated;
grant execute on function public.admin_save_titles(text,json)                  to anon, authenticated;
grant execute on function public.admin_set_card_size(text,int)                 to anon, authenticated;
grant execute on function public.admin_clear(text)                             to anon, authenticated;
grant execute on function public.admin_seed(text)                              to anon, authenticated;
