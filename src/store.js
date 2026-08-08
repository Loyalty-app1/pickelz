// Couche d'accès aux données — Supabase (Postgres + temps réel).
// L'app garde en mémoire la même forme qu'avant ({ users, rewards, titles,
// cardSize }) ; ce module traduit les lignes Supabase vers/depuis cette forme.

import { supabase } from "./supabase.js";

export const SERVER_CODES = ["1111", "2222", "5555", "7777"];
export const ADMIN_PASS = "0000"; // ponytail: pas d'auth — même mécanisme qu'avant

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

// Chemins d'assets (dev comme GitHub Pages : sous-chemin /pickelz/)
export const IMG_STAMP = `${import.meta.env.BASE_URL}images/stamp.png`;
export const IMG_LOGO = `${import.meta.env.BASE_URL}images/logo-cream.png`;
export const IMG_LOGO_MAUVE = `${import.meta.env.BASE_URL}images/logo-mauve.png`;
export const BASE = import.meta.env.BASE_URL;

export const BRAND = "Pickel'z";
export const TAGLINE = "Burger and more !";
export const INSTA_HANDLE = "@pickelz";

// Valeurs par défaut (re-semées lors d'un "vidage" admin)
export const DEFAULT_REWARDS = [
  { visit: 5, label: "10% de réduction", detail: "Plafonnée à 10 DT", kind: "discount", capped: true },
  { visit: 10, label: "Soda offert", detail: "La boisson fraîche de votre choix", kind: "treat", capped: false },
  { visit: 15, label: "20% de réduction", detail: "Plafonnée à 10 DT", kind: "discount", capped: true },
  { visit: 20, label: "Crêpe Nutella offerte", detail: "La classique, généreusement garnie", kind: "treat", capped: false },
  { visit: 27, label: "10% de réduction", detail: "Sans plafond", kind: "discount", capped: false },
  { visit: 33, label: "20% de réduction", detail: "Sans plafond", kind: "discount", capped: false },
  { visit: 40, label: "40% de réduction", detail: "Sans plafond", kind: "discount", capped: false },
  { visit: 50, label: "Milkshake Oreo offert", detail: "Le boss final, bien mérité", kind: "treat", capped: false },
];

export const DEFAULT_TITLES = [
  { min: 0, label: "Petite Faim" },
  { min: 10, label: "Habitué du Comptoir" },
  { min: 20, label: "Grand Croqueur" },
  { min: 35, label: "Maître du Burger" },
  { min: 50, label: "Légende Pickel'z" },
];

/* ============ Helpers purs (inchangés, opèrent sur la forme mémoire) ============ */

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

// Parcours du mois : dérivé des visites du mois courant, plafonné à la carte.
export function monthVisits(user, cardSize = DEFAULT_CARD_SIZE, ref = new Date()) {
  return Math.min(user.history.filter((h) => isSameMonth(h.date, ref)).length, cardSize);
}

export function formatDateFR(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

/* ============ Génération de code : INITIALES + "-" + 6 chiffres ============ */

export function initials(name) {
  const letters = (name || "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return letters.slice(0, 3) || "X";
}

export function generateUniqueCode(name, existingCodes) {
  const prefix = initials(name);
  let code;
  do {
    code = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
  } while (existingCodes.has(code));
  return code;
}

/* ============ Traduction lignes Supabase → forme mémoire ============ */

function mapVisit(v) {
  return { id: v.id, date: v.created_at, type: v.type, serverCode: v.server_code };
}

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

// Charge tout et reconstruit { users, rewards, titles, cardSize }.
export async function fetchDB() {
  const [cRes, vRes, rRes, tRes, sRes] = await Promise.all([
    supabase.from("customers").select("*"),
    supabase.from("visits").select("*"),
    supabase.from("rewards").select("*"),
    supabase.from("titles").select("*"),
    supabase.from("settings").select("card_size").eq("id", true).maybeSingle(),
  ]);

  const err = cRes.error || vRes.error || rRes.error || tRes.error || sRes.error;
  if (err) throw err;

  const visitsByCustomer = new Map();
  for (const v of vRes.data || []) {
    if (!visitsByCustomer.has(v.customer_id)) visitsByCustomer.set(v.customer_id, []);
    visitsByCustomer.get(v.customer_id).push(v);
  }

  const users = (cRes.data || [])
    .map((row) => ({
      id: row.code, // identité côté app = code de connexion
      dbId: row.id, // uuid interne (FK visites)
      name: row.name,
      nickname: row.nickname || "",
      phone: row.phone || "",
      instagram: row.instagram || "",
      promoOptIn: Boolean(row.promo_opt_in),
      history: (visitsByCustomer.get(row.id) || [])
        .map(mapVisit)
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    users,
    rewards: (rRes.data || []).map(mapReward).sort((a, b) => a.visit - b.visit),
    titles: (tRes.data || []).map(mapTitle).sort((a, b) => a.min - b.min),
    cardSize: sanitizeCardSize(sRes.data ? sRes.data.card_size : DEFAULT_CARD_SIZE),
  };
}

/* ============ Mutations ============ */

// Retourne l'utilisateur créé (forme mémoire) ou lève une erreur.
export async function createCustomer(fields, existingCodes) {
  const code = generateUniqueCode(fields.name, existingCodes);
  const { data, error } = await supabase
    .from("customers")
    .insert({
      code,
      name: fields.name,
      nickname: fields.nickname,
      phone: fields.phone,
      instagram: fields.instagram || "",
      promo_opt_in: Boolean(fields.promoOptIn),
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.code,
    dbId: data.id,
    name: data.name,
    nickname: data.nickname || "",
    phone: data.phone || "",
    instagram: data.instagram || "",
    promoOptIn: Boolean(data.promo_opt_in),
    history: [],
  };
}

export async function addVisit(customerDbId, type, serverCode) {
  const { data, error } = await supabase
    .from("visits")
    .insert({ customer_id: customerDbId, type, server_code: serverCode })
    .select()
    .single();
  if (error) throw error;
  return mapVisit(data);
}

export async function updateCustomer(dbId, patch) {
  const { error } = await supabase
    .from("customers")
    .update({
      name: patch.name,
      nickname: patch.nickname,
      phone: patch.phone,
      instagram: patch.instagram || "",
      promo_opt_in: Boolean(patch.promoOptIn),
    })
    .eq("id", dbId);
  if (error) throw error;
}

export async function upsertReward(reward) {
  const payload = {
    visit: Number(reward.visit),
    label: reward.label,
    detail: reward.detail || "",
    kind: reward.kind,
    capped: Boolean(reward.capped),
    active_from: reward.activeFrom || null,
    active_to: reward.activeTo || null,
  };
  // Un id uuid existant → update ; sinon insert (nouvelle récompense).
  const isUuid = typeof reward.id === "string" && /^[0-9a-f-]{36}$/i.test(reward.id);
  const { error } = isUuid
    ? await supabase.from("rewards").update(payload).eq("id", reward.id)
    : await supabase.from("rewards").insert(payload);
  if (error) throw error;
}

export async function deleteReward(id) {
  const { error } = await supabase.from("rewards").delete().eq("id", id);
  if (error) throw error;
}

// Remplace toute la cascade de titres.
export async function saveTitles(rows) {
  const del = await supabase.from("titles").delete().gte("min_visits", 0);
  if (del.error) throw del.error;
  const { error } = await supabase
    .from("titles")
    .insert(rows.map((r) => ({ min_visits: Number(r.min), label: r.label })));
  if (error) throw error;
}

export async function setCardSize(n) {
  const { error } = await supabase
    .from("settings")
    .update({ card_size: sanitizeCardSize(n), updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) throw error;
}

/* ============ TEMP : outils de démo (seed / vidage) ============ */

const SEED_NAMES = [
  ["Camille Moreau", "Cam", "camille.mr"],
  ["Yassine Ben Ali", "Yass", "yass.benali"],
  ["Emna Trabelsi", "Emy", "emna_tbl"],
  ["Louis Fontaine", "Lou", ""],
  ["Sarra Mansour", "Sasa", "sarra.mn"],
  ["Karim Haddad", "Kaki", "karim.hd"],
  ["Nour Gharbi", "Nunu", "nour.gh"],
  ["Amine Jelassi", "Mimo", "aminejl"],
  ["Léa Bouazizi", "Léa", "lea.bzz"],
  ["Omar Chennoufi", "Oma", "omar.chn"],
  ["Ines Kallel", "Nina", "ines.kl"],
  ["Hugo Bernard", "Hug", ""],
];

export async function seedDemo() {
  const existing = await supabase.from("customers").select("code");
  if (existing.error) throw existing.error;
  const codes = new Set((existing.data || []).map((c) => c.code));

  const rows = SEED_NAMES.map(([name, nickname, instagram], idx) => {
    const code = generateUniqueCode(name, codes);
    codes.add(code);
    return {
      code,
      name,
      nickname,
      phone: `+216 2${idx} ${100 + idx} ${200 + idx}`,
      instagram,
      promo_opt_in: idx % 3 !== 0,
    };
  });

  const ins = await supabase.from("customers").insert(rows).select();
  if (ins.error) throw ins.error;

  const now = new Date();
  const monthCounts = [3, 7, 12, 0, 22, 15, 34, 50, 5, 18, 27, 9];
  const pastCounts = [4, 10, 6, 14, 20, 8, 25, 30, 2, 12, 16, 5];
  const visits = [];
  ins.data.forEach((cust, idx) => {
    for (let i = 0; i < pastCounts[idx]; i++) {
      const back = 28 + Math.floor(Math.random() * 140);
      visits.push({
        customer_id: cust.id,
        type: Math.random() < 0.55 ? "instagram" : "google",
        server_code: SERVER_CODES[i % 4],
        created_at: new Date(now.getTime() - back * 86400000).toISOString(),
      });
    }
    for (let i = 0; i < monthCounts[idx]; i++) {
      const back = Math.floor(Math.random() * Math.min(now.getDate() - 1, 27));
      visits.push({
        customer_id: cust.id,
        type: Math.random() < 0.55 ? "instagram" : "google",
        server_code: SERVER_CODES[i % 4],
        created_at: new Date(now.getTime() - back * 86400000).toISOString(),
      });
    }
  });
  if (visits.length) {
    const vIns = await supabase.from("visits").insert(visits);
    if (vIns.error) throw vIns.error;
  }
}

// Vide tout et re-sème les récompenses / titres / taille par défaut.
export async function clearAll() {
  const c = await supabase.from("customers").delete().not("id", "is", null); // visites en cascade
  if (c.error) throw c.error;
  await supabase.from("rewards").delete().not("id", "is", null);
  await supabase.from("titles").delete().not("id", "is", null);
  await supabase.from("rewards").insert(
    DEFAULT_REWARDS.map((r) => ({
      visit: r.visit,
      label: r.label,
      detail: r.detail,
      kind: r.kind,
      capped: r.capped,
    }))
  );
  await supabase.from("titles").insert(
    DEFAULT_TITLES.map((t) => ({ min_visits: t.min, label: t.label }))
  );
  await supabase.from("settings").update({ card_size: DEFAULT_CARD_SIZE }).eq("id", true);
}
