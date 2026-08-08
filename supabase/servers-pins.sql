-- ============================================================
--  Pickel'z — codes serveur individuels + rotation 24 h,
--  code admin modifiable, code client choisi à l'inscription.
--  Delta appliqué par-dessus harden.sql. Ré-exécutable sans risque.
-- ============================================================

-- ---------- Serveurs : un code par serveur, tournant toutes les 24 h ----------
create table if not exists public.servers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  code            text not null,
  code_updated_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- Génère un code numérique à 4 chiffres, unique parmi les serveurs.
create or replace function public._gen_server_code()
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  loop
    v := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from servers s where s.code = v);
  end loop;
  return v;
end $$;

-- Régénère les codes vieux de plus de 24 h (ligne par ligne → pas de collision).
create or replace function public._rotate_servers()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from servers where code_updated_at < now() - interval '24 hours' loop
    update servers set code = _gen_server_code(), code_updated_at = now() where id = r.id;
  end loop;
end $$;

create or replace function public._servers_json()
returns json language sql security definer set search_path = public as $$
  select coalesce((select json_agg(json_build_object(
      'id', s.id, 'name', s.name, 'code', s.code, 'codeUpdatedAt', s.code_updated_at)
    order by s.name) from servers s), '[]'::json);
$$;

-- Amorce quelques serveurs si la table est vide (codes frais).
insert into public.servers(name, code)
select v.name, _gen_server_code()
from (values ('Serveur 1'), ('Serveur 2'), ('Serveur 3'), ('Serveur 4')) as v(name)
where not exists (select 1 from servers);

-- ---------- add_visit : le code saisi doit être celui d'un serveur (frais) ----------
create or replace function public.add_visit(p_code text, p_pin text, p_type text)
returns json language plpgsql security definer set search_path = public as $$
declare cid uuid; sid uuid;
begin
  perform _rotate_servers();
  select id into sid from servers
    where code = btrim(coalesce(p_pin, ''))
      and code_updated_at > now() - interval '24 hours';
  if sid is null then raise exception 'bad_pin'; end if;
  if p_type not in ('instagram', 'google') then raise exception 'bad_type'; end if;
  select id into cid from customers where code = upper(btrim(coalesce(p_code, '')));
  if cid is null then raise exception 'no_customer'; end if;
  insert into visits(customer_id, type, server_code) values (cid, p_type, btrim(p_pin));
  return _customer_json(cid);
end $$;

-- ---------- Code client choisi à l'inscription (fallback : généré) ----------
drop function if exists public.create_customer(text, text, text, text, boolean);
create or replace function public.create_customer(
  p_name text, p_nickname text, p_phone text, p_instagram text, p_promo boolean, p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare newid uuid; v_code text;
begin
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'invalid_name'; end if;
  if length(btrim(coalesce(p_nickname, ''))) < 2 then raise exception 'invalid_nickname'; end if;
  if length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) not between 7 and 15
    then raise exception 'invalid_phone'; end if;
  v_code := upper(btrim(coalesce(p_code, '')));
  if v_code = '' then
    v_code := _gen_code(p_name);
  else
    if length(v_code) not between 4 and 20 or v_code !~ '^[A-Z0-9-]+$'
      then raise exception 'invalid_code'; end if;
    if exists (select 1 from customers c where c.code = v_code) then raise exception 'code_taken'; end if;
  end if;
  insert into customers(code, name, nickname, phone, instagram, promo_opt_in)
    values (v_code, btrim(p_name), btrim(p_nickname), btrim(p_phone),
            btrim(coalesce(p_instagram, '')), coalesce(p_promo, false))
    returning id into newid;
  return _customer_json(newid);
end $$;

-- ---------- Admin : gérer les serveurs, changer le code admin ----------
create or replace function public.admin_add_server(p_pin text, p_name text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pin) then raise exception 'forbidden'; end if;
  if length(btrim(coalesce(p_name, ''))) < 1 then raise exception 'invalid_name'; end if;
  perform _rotate_servers();
  insert into servers(name, code) values (btrim(p_name), _gen_server_code());
  return _servers_json();
end $$;

create or replace function public.admin_remove_server(p_pin text, p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pin) then raise exception 'forbidden'; end if;
  delete from servers where id = p_id;
  perform _rotate_servers();
  return _servers_json();
end $$;

create or replace function public.admin_set_pin(p_pin text, p_new_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pin) then raise exception 'forbidden'; end if;
  if length(btrim(coalesce(p_new_pin, ''))) < 4 then raise exception 'weak_pin'; end if;
  update app_secrets set admin_pin = btrim(p_new_pin) where id = true;
end $$;

-- ---------- admin_snapshot : inclut désormais les serveurs (codes frais) ----------
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
    'titles', coalesce((select json_agg(json_build_object(
        'id', t.id, 'min', t.min_visits, 'label', t.label) order by t.min_visits) from titles t), '[]'::json),
    'cardSize', (select card_size from settings where id = true),
    'servers', _servers_json()
  );
end $$;

-- ---------- Verrouillage + droits ----------
revoke all on public.servers from anon, authenticated;
alter table public.servers enable row level security;  -- aucune policy → aucun accès direct

alter table public.app_secrets drop column if exists server_pins;  -- remplacé par la table servers

revoke execute on function public._gen_server_code()  from public;
revoke execute on function public._rotate_servers()   from public;
revoke execute on function public._servers_json()      from public;

grant execute on function public.create_customer(text, text, text, text, boolean, text) to anon, authenticated;
grant execute on function public.admin_add_server(text, text)    to anon, authenticated;
grant execute on function public.admin_remove_server(text, uuid) to anon, authenticated;
grant execute on function public.admin_set_pin(text, text)       to anon, authenticated;
