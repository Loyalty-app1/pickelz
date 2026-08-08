-- ============================================================
--  Pickel'z — refonte 2026-08-08 :
--   • codes serveur renouvelés à 8h (heure de Tunis) chaque jour
--   • add_visit fige le nom du serveur (server_name) sur la visite
--   • journal "Commandes du jour" (24 h) pour l'admin
--   • suppression des titres (table + RPC) et de la roue (aucune table dédiée)
--  Delta par-dessus servers-pins.sql. Ré-exécutable sans risque.
-- ============================================================

-- ---------- Fige le nom du serveur sur chaque visite ----------
alter table public.visits add column if not exists server_name text;

-- ---------- Bascule des codes à 8h (Africa/Tunis), sans cron ----------
-- Début du cycle courant = dernier passage à 08:00 heure de Tunis.
create or replace function public._code_cycle_start()
returns timestamptz language sql stable set search_path = public as $$
  select case when now() >= t8 then t8 else t8 - interval '1 day' end
  from (
    select (date_trunc('day', now() at time zone 'Africa/Tunis') + interval '8 hours')
           at time zone 'Africa/Tunis' as t8
  ) s;
$$;

-- Régénère (à l'accès) tout code émis avant le passage de 8h du jour.
create or replace function public._rotate_servers()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from servers where code_updated_at < _code_cycle_start() loop
    update servers set code = _gen_server_code(), code_updated_at = now() where id = r.id;
  end loop;
end $$;

-- ---------- add_visit : code valide = celui d'un serveur émis ce cycle ----------
create or replace function public.add_visit(p_code text, p_pin text, p_type text)
returns json language plpgsql security definer set search_path = public as $$
declare cid uuid; srv record;
begin
  perform _rotate_servers();
  select s.id, s.name into srv from servers s
    where s.code = btrim(coalesce(p_pin, ''))
      and s.code_updated_at >= _code_cycle_start();
  if srv.id is null then raise exception 'bad_pin'; end if;
  if p_type not in ('instagram', 'google') then raise exception 'bad_type'; end if;
  select id into cid from customers where code = upper(btrim(coalesce(p_code, '')));
  if cid is null then raise exception 'no_customer'; end if;
  insert into visits(customer_id, type, server_code, server_name)
    values (cid, p_type, btrim(p_pin), srv.name);
  return _customer_json(cid);
end $$;

-- ---------- Commandes du jour (24 h) pour l'admin ----------
create or replace function public.admin_recent_orders(p_pin text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pin) then return null; end if;
  return coalesce((
    select json_agg(json_build_object(
      'id', v.id, 'date', v.created_at, 'type', v.type,
      'serverCode', v.server_code, 'serverName', v.server_name,
      'customer', c.name, 'nickname', c.nickname, 'code', c.code)
      order by v.created_at desc)
    from visits v join customers c on c.id = v.customer_id
    where v.created_at >= now() - interval '24 hours'), '[]'::json);
end $$;

-- ---------- Suppression titres + roue ----------
drop function if exists public.month_participants();
drop function if exists public.admin_save_titles(text, json);
drop table if exists public.titles cascade;  -- retire policy, grants et realtime

-- admin_snapshot sans titres
create or replace function public.admin_snapshot(p_pin text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pin) then return null; end if;
  perform _rotate_servers();
  return json_build_object(
    'users', coalesce((select json_agg(_customer_json(c.id) order by c.name) from customers c), '[]'::json),
    'rewards', coalesce((select json_agg(json_build_object(
        'id', r.id, 'visit', r.visit, 'label', r.label, 'detail', r.detail,
        'kind', r.kind, 'capped', r.capped, 'activeFrom', r.active_from, 'activeTo', r.active_to)
      order by r.visit) from rewards r), '[]'::json),
    'cardSize', (select card_size from settings where id = true),
    'servers', _servers_json()
  );
end $$;

-- admin_clear sans titres
create or replace function public.admin_clear(p_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pin) then raise exception 'forbidden'; end if;
  delete from customers where true;
  delete from rewards where true;
  insert into rewards(visit, label, detail, kind, capped) values
    (5,  '10% de réduction',      'Plafonnée à 10 DT',                  'discount', true),
    (10, 'Soda offert',           'La boisson fraîche de votre choix',  'treat',    false),
    (15, '20% de réduction',      'Plafonnée à 10 DT',                  'discount', true),
    (20, 'Crêpe Nutella offerte', 'La classique, généreusement garnie', 'treat',    false),
    (27, '10% de réduction',      'Sans plafond',                       'discount', false),
    (33, '20% de réduction',      'Sans plafond',                       'discount', false),
    (40, '40% de réduction',      'Sans plafond',                       'discount', false),
    (50, 'Milkshake Oreo offert', 'Le boss final, bien mérité',         'treat',    false);
  update settings set card_size = 50 where id = true;
end $$;

-- ---------- Droits ----------
revoke execute on function public._code_cycle_start() from public;
grant execute on function public.admin_recent_orders(text) to anon, authenticated;
