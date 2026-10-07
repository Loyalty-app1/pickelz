-- ============================================================
--  Pickel'z — Récompenses serveur (2026-10-06) :
--   • nombre de commandes validées par serveur, par type de preuve,
--     sur une période choisie (jours calendaires, heure de Tunis)
--   • alimente l'onglet admin « Récompenses serveur »
--  Delta par-dessus revamp.sql. Ré-exécutable sans risque.
-- ============================================================

-- Agrégat serveur × preuve sur [p_from, p_to] (dates incluses, null = sans borne).
-- Le nom est celui figé sur la visite (visits.server_name) : un serveur retiré
-- garde ses commandes ; les visites antérieures au suivi ont server = null.
-- 'servers' = équipe actuelle, pour afficher aussi les serveurs à zéro.
create or replace function public.admin_server_orders(p_pin text, p_from date, p_to date)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not _admin_ok(p_pin) then return null; end if;
  return json_build_object(
    'servers', coalesce((select json_agg(s.name order by s.name) from servers s), '[]'::json),
    'rows', coalesce((
      select json_agg(json_build_object('server', g.server_name, 'type', g.type, 'n', g.n))
      from (
        select v.server_name, v.type, count(*)::int as n
        from visits v
        where (p_from is null or v.created_at >= p_from::timestamp at time zone 'Africa/Tunis')
          and (p_to   is null or v.created_at <  (p_to + 1)::timestamp at time zone 'Africa/Tunis')
        group by v.server_name, v.type
      ) g), '[]'::json)
  );
end $$;

grant execute on function public.admin_server_orders(text, date, date) to anon, authenticated;
