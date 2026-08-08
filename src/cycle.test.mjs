// Vérif du cycle mensuel ancré à la 1re visite. `node src/cycle.test.mjs`
import assert from "node:assert";
import { cycleStart, monthVisits } from "./store.js";

const d = (s) => `${s}T12:00:00`;
const user = {
  history: [
    { date: d("2026-01-15") }, // 1re visite
    { date: d("2026-01-16") },
    { date: d("2026-02-16") },
    { date: d("2026-02-17") },
    { date: d("2026-02-18") },
  ],
};

// cycleStart = date anniversaire du mois en cours
assert.strictEqual(cycleStart(d("2026-01-15"), new Date(d("2026-01-20"))).getDate(), 15);
assert.strictEqual(cycleStart(d("2026-01-15"), new Date(d("2026-02-20"))).getMonth(), 1); // février
assert.strictEqual(cycleStart(d("2026-01-15"), new Date(d("2026-02-10"))).getMonth(), 0); // janvier

// monthVisits ne compte que le cycle courant
assert.strictEqual(monthVisits(user, 50, new Date(d("2026-01-20"))), 2); // Jan 15,16
assert.strictEqual(monthVisits(user, 50, new Date(d("2026-02-20"))), 3); // Fév 16,17,18
assert.strictEqual(monthVisits(user, 50, new Date(d("2026-02-10"))), 2); // avant reset de fév
assert.strictEqual(monthVisits({ history: [] }, 50), 0);
assert.strictEqual(monthVisits(user, 2, new Date(d("2026-02-20"))), 2); // plafond carte

console.log("cycle.test OK");
