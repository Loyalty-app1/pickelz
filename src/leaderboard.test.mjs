// Vérif du classement « Récompenses serveur ». `node src/leaderboard.test.mjs`
import assert from "node:assert";
import { serverLeaderboard } from "./store.js";

const data = {
  servers: ["Amine", "Sarra", "Yassine"], // équipe actuelle (Yassine : aucune commande)
  rows: [
    { server: "Amine", type: "instagram", n: 5 },
    { server: "Amine", type: "google", n: 2 },
    { server: "Sarra", type: "google", n: 7 },
    { server: "Karim", type: "instagram", n: 1 }, // serveur retiré, commandes conservées
    { server: null, type: "instagram", n: 4 }, // visite antérieure au suivi
    { server: null, type: "google", n: 3 },
  ],
};

// Tout : Amine 7 = Sarra 7 → ex æquo au 1er rang, départage alphabétique
const all = serverLeaderboard(data, "all");
assert.deepStrictEqual(
  all.list.map((s) => [s.name, s.total, s.rank]),
  [["Amine", 7, 1], ["Sarra", 7, 1], ["Karim", 1, 3], ["Yassine", 0, 4]]
);
assert.strictEqual(all.unassigned, 7);
assert.strictEqual(all.list.find((s) => s.name === "Karim").former, true);
assert.strictEqual(all.list.find((s) => s.name === "Yassine").former, false);
// Le détail par preuve reste disponible quel que soit le filtre
assert.deepStrictEqual([all.list[0].instagram, all.list[0].google], [5, 2]);

// Filtre Instagram : seul le total change
const ig = serverLeaderboard(data, "instagram");
assert.deepStrictEqual(
  ig.list.map((s) => [s.name, s.total, s.rank]),
  [["Amine", 5, 1], ["Karim", 1, 2], ["Sarra", 0, 3], ["Yassine", 0, 3]]
);
assert.strictEqual(ig.unassigned, 4);

// Filtre Google
const gg = serverLeaderboard(data, "google");
assert.deepStrictEqual(gg.list.slice(0, 2).map((s) => [s.name, s.total]), [["Sarra", 7], ["Amine", 2]]);
assert.strictEqual(gg.unassigned, 3);

// Réponse vide / RPC pas encore chargée
assert.deepStrictEqual(serverLeaderboard(undefined), { list: [], unassigned: 0 });
assert.deepStrictEqual(serverLeaderboard({ servers: ["A"], rows: [] }).list[0].total, 0);

console.log("leaderboard.test OK");
