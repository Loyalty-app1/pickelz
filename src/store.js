// Couche d'accès — Supabase durci.
// La config (rewards/titles/settings) est lisible directement par anon.
// Tout le reste (clients, visites, admin) passe par des RPC SECURITY DEFINER :
// anon ne peut ni lire les données perso ni écrire en direct. Les PIN (serveur
// et admin) vivent en base, plus dans ce bundle.

import { supabase } from "./supabase.js";

// Taille de carte : grille à 5 colonnes → multiple de 5.
export const CARD_STEP = 5;
export const DEFAULT_CARD_SIZE = 50;
export const MAX_CARD_SIZE = 100;

export function sanitizeCardSize(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_CARD_SIZE;
  const clamped = Math.min(MAX_CARD_SIZE, Math.max(CARD_STEP, Math.round(n)));
  return Math.round(clamped / CARD_STEP) * CARD_STEP;
}

// Chemins d'assets (sous-chemin GitHub Pages /pickelz/)
const ENV_BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";
export const IMG_STAMP = `${ENV_BASE}images/stamp.png`;
export const IMG_LOGO = `${ENV_BASE}images/logo-cream.png`;
export const IMG_LOGO_MAUVE = `${ENV_BASE}images/logo-mauve.png`;
export const BASE = ENV_BASE;

export const BRAND = "Pickel'z";
export const TAGLINE = "Burger and more !";
export const INSTA_HANDLE = "@pickelz";

export const DEV_CREDIT = "Aboulkacem";
export const DEV_LINKEDIN = "https://www.linkedin.com/in/aboulkacem-ben-arab-567974241/";

/* ============ Helpers purs ============ */

export function isRewardActive(reward, ref = new Date()) {
  const day = ref.toISOString().slice(0, 10);
  if (reward.activeFrom && day < reward.activeFrom) return false;
  if (reward.activeTo && day > reward.activeTo) return false;
  return true;
}

export function activeRewards(rewards, ref = new Date()) {
  return rewards.filter((r) => isRewardActive(r, ref)).sort((a, b) => a.visit - b.visit);
}

export function isSameMonth(iso, ref = new Date()) {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

// Début du cycle courant : la carte se remet à zéro chaque mois, à la date
// anniversaire de la première visite du client (pas le 1er du mois calendaire).
// ponytail: arithmétique de mois JS (setMonth) — le 31 déborde sur le mois suivant, acceptable ici.
export function cycleStart(firstIso, ref = new Date()) {
  const start = new Date(firstIso);
  for (;;) {
    const next = new Date(start);
    next.setMonth(next.getMonth() + 1);
    if (next > ref) return start;
    start.setTime(next.getTime());
  }
}

export function monthVisits(user, cardSize = DEFAULT_CARD_SIZE, ref = new Date()) {
  if (!user.history || user.history.length === 0) return 0;
  const dates = user.history.map((h) => new Date(h.date)).sort((a, b) => a - b);
  const start = cycleStart(dates[0], ref);
  const count = dates.filter((d) => d >= start && d <= ref).length;
  return Math.min(count, cardSize);
}

export function formatDateFR(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/* ============ Config (lecture directe anon) ============ */

function mapReward(r) {
  return {
    id: r.id,
    visit: r.visit,
    label: r.label,
    detail: r.detail || "",
    kind: r.kind,
    capped: Boolean(r.capped),
    activeFrom: r.active_from || "",
    activeTo: r.active_to || "",
  };
}

export async function fetchConfig() {
  const [rRes, sRes] = await Promise.all([
    supabase.from("rewards").select("*"),
    supabase.from("settings").select("card_size").eq("id", true).maybeSingle(),
  ]);
  const err = rRes.error || sRes.error;
  if (err) throw err;
  return {
    rewards: (rRes.data || []).map(mapReward).sort((a, b) => a.visit - b.visit),
    cardSize: sanitizeCardSize(sRes.data ? sRes.data.card_size : DEFAULT_CARD_SIZE),
  };
}

/* ============ RPC client ============ */

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export async function loginCustomer(code) {
  return unwrap(await supabase.rpc("login_customer", { p_code: code }));
}

// fields.code : code choisi par le client (vide = généré côté serveur).
// Lève une erreur dont .message vaut 'code_taken' ou 'invalid_code' le cas échéant.
export async function createCustomer(fields) {
  return unwrap(
    await supabase.rpc("create_customer", {
      p_name: fields.name,
      p_nickname: fields.nickname,
      p_phone: fields.phone,
      p_instagram: fields.instagram || "",
      p_promo: Boolean(fields.promoOptIn),
      p_code: (fields.code || "").trim().toUpperCase(),
    })
  );
}

// Lève une erreur dont .message vaut 'bad_pin' si le code serveur est invalide.
export async function addVisit(code, pin, type) {
  return unwrap(await supabase.rpc("add_visit", { p_code: code, p_pin: pin, p_type: type }));
}

export async function updateCustomer(code, patch) {
  return unwrap(
    await supabase.rpc("update_customer", {
      p_code: code,
      p_name: patch.name,
      p_nickname: patch.nickname,
      p_phone: patch.phone,
      p_instagram: patch.instagram || "",
      p_promo: Boolean(patch.promoOptIn),
    })
  );
}

/* ============ RPC admin (PIN vérifié en base) ============ */

// Renvoie le snapshot complet (users+config) si le PIN est bon, sinon null.
export async function adminSnapshot(pin) {
  return unwrap(await supabase.rpc("admin_snapshot", { p_pin: pin }));
}

export async function adminUpsertReward(pin, reward) {
  const isUuid = typeof reward.id === "string" && /^[0-9a-f-]{36}$/i.test(reward.id);
  return unwrap(
    await supabase.rpc("admin_upsert_reward", {
      p_pin: pin,
      p_id: isUuid ? reward.id : null,
      p_visit: Number(reward.visit),
      p_label: reward.label,
      p_detail: reward.detail || "",
      p_kind: reward.kind,
      p_capped: Boolean(reward.capped),
      p_active_from: reward.activeFrom || null,
      p_active_to: reward.activeTo || null,
    })
  );
}

export async function adminDeleteReward(pin, id) {
  return unwrap(await supabase.rpc("admin_delete_reward", { p_pin: pin, p_id: id }));
}

// Commandes validées sur les dernières 24 h (nom serveur figé à la validation).
export async function adminRecentOrders(pin) {
  return unwrap(await supabase.rpc("admin_recent_orders", { p_pin: pin })) || [];
}

export async function adminSetCardSize(pin, n) {
  return unwrap(await supabase.rpc("admin_set_card_size", { p_pin: pin, p_n: sanitizeCardSize(n) }));
}

export async function adminSeed(pin) {
  return unwrap(await supabase.rpc("admin_seed", { p_pin: pin }));
}

export async function adminClear(pin) {
  return unwrap(await supabase.rpc("admin_clear", { p_pin: pin }));
}

// Serveurs : chaque serveur a son code (renouvelé toutes les 24 h côté base).
// Ces RPC renvoient la liste à jour des serveurs.
export async function adminAddServer(pin, name) {
  return unwrap(await supabase.rpc("admin_add_server", { p_pin: pin, p_name: name }));
}

export async function adminRemoveServer(pin, id) {
  return unwrap(await supabase.rpc("admin_remove_server", { p_pin: pin, p_id: id }));
}

// Change le code admin. Lève une erreur .message='weak_pin' si trop court.
export async function adminSetPin(pin, newPin) {
  return unwrap(await supabase.rpc("admin_set_pin", { p_pin: pin, p_new_pin: newPin }));
}
