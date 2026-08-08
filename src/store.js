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
export const IMG_STAMP = `${import.meta.env.BASE_URL}images/stamp.png`;
export const IMG_LOGO = `${import.meta.env.BASE_URL}images/logo-cream.png`;
export const IMG_LOGO_MAUVE = `${import.meta.env.BASE_URL}images/logo-mauve.png`;
export const BASE = import.meta.env.BASE_URL;

export const BRAND = "Pickel'z";
export const TAGLINE = "Burger and more !";
export const INSTA_HANDLE = "@pickelz";

export const DEFAULT_TITLES = [
  { min: 0, label: "Petite Faim" },
  { min: 10, label: "Habitué du Comptoir" },
  { min: 20, label: "Grand Croqueur" },
  { min: 35, label: "Maître du Burger" },
  { min: 50, label: "Légende Pickel'z" },
];

/* ============ Helpers purs ============ */

export function getTitle(titles, visits) {
  const sorted = [...titles].sort((a, b) => a.min - b.min);
  let current = sorted[0] ? sorted[0].label : "";
  for (const t of sorted) if (visits >= t.min) current = t.label;
  return current;
}

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

export function monthVisits(user, cardSize = DEFAULT_CARD_SIZE, ref = new Date()) {
  return Math.min(user.history.filter((h) => isSameMonth(h.date, ref)).length, cardSize);
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

function mapTitle(t) {
  return { id: t.id, min: t.min_visits, label: t.label };
}

export async function fetchConfig() {
  const [rRes, tRes, sRes] = await Promise.all([
    supabase.from("rewards").select("*"),
    supabase.from("titles").select("*"),
    supabase.from("settings").select("card_size").eq("id", true).maybeSingle(),
  ]);
  const err = rRes.error || tRes.error || sRes.error;
  if (err) throw err;
  return {
    rewards: (rRes.data || []).map(mapReward).sort((a, b) => a.visit - b.visit),
    titles: (tRes.data || []).map(mapTitle).sort((a, b) => a.min - b.min),
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

export async function createCustomer(fields) {
  return unwrap(
    await supabase.rpc("create_customer", {
      p_name: fields.name,
      p_nickname: fields.nickname,
      p_phone: fields.phone,
      p_instagram: fields.instagram || "",
      p_promo: Boolean(fields.promoOptIn),
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

export async function monthParticipants() {
  return unwrap(await supabase.rpc("month_participants")) || [];
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

export async function adminSaveTitles(pin, rows) {
  return unwrap(
    await supabase.rpc("admin_save_titles", {
      p_pin: pin,
      p_titles: rows.map((r) => ({ min: Number(r.min), label: r.label })),
    })
  );
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
