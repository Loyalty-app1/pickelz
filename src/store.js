// Source de vérité partagée : app cliente, roulette et pages admin.

export const STORAGE_KEY = "tfc_fidelite";
export const SERVER_CODES = ["1111", "2222", "5555", "7777"];
export const MAX_VISITS = 50;
export const ADMIN_PASS = "0000"; // ponytail: stocké en local pour l'instant — Supabase ensuite

// Chemins d'assets valables en dev comme sur GitHub Pages ("/Thefirst/")
export const IMG_STAMP = `${import.meta.env.BASE_URL}images/stamp.png`;
export const IMG_LOGO = `${import.meta.env.BASE_URL}images/logo-cream.png`;
export const IMG_LOGO_MAUVE = `${import.meta.env.BASE_URL}images/logo-mauve.png`;
export const BASE = import.meta.env.BASE_URL;

export const BRAND = "Pickel'z";
export const TAGLINE = "Burger and more !";
export const INSTA_HANDLE = "@pickelz";

// Récompenses par défaut — du moins cher au plus cher ; sans plafond aux paliers élevés
export const DEFAULT_REWARDS = [
  { id: "r-5", visit: 5, label: "10% de réduction", detail: "Plafonnée à 10 DT", kind: "discount", capped: true, activeFrom: "", activeTo: "" },
  { id: "r-10", visit: 10, label: "Soda offert", detail: "La boisson fraîche de votre choix", kind: "treat", capped: false, activeFrom: "", activeTo: "" },
  { id: "r-15", visit: 15, label: "20% de réduction", detail: "Plafonnée à 10 DT", kind: "discount", capped: true, activeFrom: "", activeTo: "" },
  { id: "r-20", visit: 20, label: "Crêpe Nutella offerte", detail: "La classique, généreusement garnie", kind: "treat", capped: false, activeFrom: "", activeTo: "" },
  { id: "r-27", visit: 27, label: "10% de réduction", detail: "Sans plafond", kind: "discount", capped: false, activeFrom: "", activeTo: "" },
  { id: "r-33", visit: 33, label: "20% de réduction", detail: "Sans plafond", kind: "discount", capped: false, activeFrom: "", activeTo: "" },
  { id: "r-40", visit: 40, label: "40% de réduction", detail: "Sans plafond", kind: "discount", capped: false, activeFrom: "", activeTo: "" },
  { id: "r-50", visit: 50, label: "Milkshake Oreo offert", detail: "Le boss final, bien mérité", kind: "treat", capped: false, activeFrom: "", activeTo: "" },
];

// 5 titres, de plus en plus prestigieux
export const DEFAULT_TITLES = [
  { min: 0, label: "Petite Faim" },
  { min: 10, label: "Habitué du Comptoir" },
  { min: 20, label: "Grand Croqueur" },
  { min: 35, label: "Maître du Burger" },
  { min: 50, label: "Légende Pickel'z" },
];

export function getTitle(titles, visits) {
  const sorted = [...titles].sort((a, b) => a.min - b.min);
  let current = sorted[0] ? sorted[0].label : "";
  for (const t of sorted) if (visits >= t.min) current = t.label;
  return current;
}

// Une récompense peut être limitée dans le temps (activeFrom / activeTo, AAAA-MM-JJ)
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

// Le parcours repart à zéro chaque mois : le compteur est TOUJOURS dérivé
// des visites du mois en cours (l'historique complet, lui, est conservé).
export function monthVisits(user, ref = new Date()) {
  return Math.min(user.history.filter((h) => isSameMonth(h.date, ref)).length, MAX_VISITS);
}

function normalizeUser(u) {
  return {
    id: u.id,
    name: u.name || "",
    nickname: u.nickname || "",
    phone: u.phone || "",
    instagram: u.instagram || "",
    promoOptIn: Boolean(u.promoOptIn),
    history: Array.isArray(u.history) ? u.history : [],
  };
}

export function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { users: [], currentUserId: null, rewards: DEFAULT_REWARDS, titles: DEFAULT_TITLES };
    }
    const parsed = JSON.parse(raw);
    return {
      users: (Array.isArray(parsed.users) ? parsed.users : []).map(normalizeUser),
      currentUserId: typeof parsed.currentUserId === "string" ? parsed.currentUserId : null,
      rewards:
        Array.isArray(parsed.rewards) && parsed.rewards.length > 0
          ? parsed.rewards
          : DEFAULT_REWARDS,
      titles:
        Array.isArray(parsed.titles) && parsed.titles.length > 0 ? parsed.titles : DEFAULT_TITLES,
    };
  } catch {
    return { users: [], currentUserId: null, rewards: DEFAULT_REWARDS, titles: DEFAULT_TITLES };
  }
}

export function saveDB(db) {
  // visitsCount est un getter dérivé — on sérialise le reste tel quel
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...db,
      users: db.users.map((u) => ({
        id: u.id,
        name: u.name,
        nickname: u.nickname,
        phone: u.phone,
        instagram: u.instagram,
        promoOptIn: u.promoOptIn,
        history: u.history,
      })),
    })
  );
}

export function generateUniqueCode(users) {
  let code = "";
  do {
    code = `CF-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (users.some((u) => u.id === code));
  return code;
}

export function generateRecordId() {
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatDateFR(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
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

export function seedDemoDB() {
  const now = new Date();
  const users = SEED_NAMES.map(([name, nickname, instagram], idx) => {
    const id = `CF-${2000 + idx}`;
    const monthCount = [3, 7, 12, 0, 22, 15, 34, 50, 5, 18, 27, 9][idx];
    const pastCount = [4, 10, 6, 14, 20, 8, 25, 30, 2, 12, 16, 5][idx];
    const history = [];
    for (let i = 0; i < pastCount; i++) {
      const back = 28 + Math.floor(Math.random() * 140);
      history.push({
        id: `v-${id}-p${i}`,
        date: new Date(now.getTime() - back * 86400000).toISOString(),
        type: Math.random() < 0.55 ? "instagram" : "google",
        serverCode: SERVER_CODES[i % 4],
      });
    }
    for (let i = 0; i < monthCount; i++) {
      const back = Math.floor(Math.random() * Math.min(now.getDate() - 1, 27));
      history.push({
        id: `v-${id}-m${i}`,
        date: new Date(now.getTime() - back * 86400000).toISOString(),
        type: Math.random() < 0.55 ? "instagram" : "google",
        serverCode: SERVER_CODES[i % 4],
      });
    }
    history.sort((a, b) => new Date(a.date) - new Date(b.date));
    return {
      id,
      name,
      nickname,
      phone: `+216 2${idx} ${100 + idx} ${200 + idx}`,
      instagram,
      promoOptIn: idx % 3 !== 0,
      history,
    };
  });
  const db = {
    users: users.map(normalizeUser),
    currentUserId: null,
    rewards: DEFAULT_REWARDS,
    titles: DEFAULT_TITLES,
  };
  saveDB(db);
  return db;
}

export function clearDB() {
  localStorage.removeItem(STORAGE_KEY);
  return loadDB();
}
