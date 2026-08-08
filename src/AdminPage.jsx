import React, { useState, useEffect, useMemo, useCallback } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { getLocalTimeZone } from "@internationalized/date";
import DateRange from "./DateRange.jsx";
import { useConfig } from "./useLiveDB.js";
import {
  MAX_CARD_SIZE,
  CARD_STEP,
  sanitizeCardSize,
  IMG_STAMP,
  IMG_LOGO,
  TAGLINE,
  BASE,
  adminSnapshot,
  adminSeed,
  adminClear,
  adminSetCardSize,
  adminUpsertReward,
  adminDeleteReward,
  adminSaveTitles,
  monthVisits,
  activeRewards,
  getTitle,
  formatDateFR,
  isSameMonth,
} from "./store.js";

const ADMIN_PIN_KEY = "tfc_admin_pin";
const adminPin = () => sessionStorage.getItem(ADMIN_PIN_KEY) || "";

// Paire catégorielle validée sur la surface mauve profonde #53293A :
// bande de luminance OKLab, plancher de chroma, séparation CVD (ΔE 80) et contraste ≥ 3:1.
const CAT_INSTAGRAM = "#C87A2F";
const CAT_GOOGLE = "#3E93C9";
// Série unique : l'apricot de marque (contraste 6.4:1 sur la carte)
const BAR_COLOR = "#FFE0C4";
const GRID_COLOR = "rgba(255, 224, 196, 0.16)";
const AXIS_TEXT = "#D1AC9F";

const ADMIN_STYLES = `
  @property --glow-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
  @keyframes glowSpin { to { --glow-angle: 360deg; } }
  .glow-ring {
    background: conic-gradient(
      from var(--glow-angle),
      transparent 0deg,
      #ffe0c4 70deg,
      #ffffff 120deg,
      #ffe0c4 170deg,
      transparent 240deg
    );
    animation: glowSpin 2.5s linear infinite;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes shakeX {
    10%, 90% { transform: translateX(-2px); }
    20%, 80% { transform: translateX(4px); }
    30%, 50%, 70% { transform: translateX(-6px); }
    40%, 60% { transform: translateX(6px); }
  }
  .animate-fade-in { animation: fadeIn 0.2s ease-out both; }
  .animate-fade-in-up { animation: fadeInUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  .animate-shake-x { animation: shakeX 0.5s ease-in-out both; }
`;

const INPUT =
  "h-12 w-full rounded-2xl border-2 border-transparent bg-surface-deep px-4 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-foreground";
const LABEL = "mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground";
const BTN =
  "h-12 rounded-full bg-accent px-6 font-display text-base font-extrabold text-accent-foreground transition-all duration-150 hover:brightness-105 active:scale-[0.97]";

/* Bordure lumineuse au survol — même animation que les cases récompense */
function GlowCard({ children, className = "" }) {
  return (
    <div className={`group relative ${className}`}>
      <div className="glow-ring absolute -inset-0.5 rounded-[1.6rem] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="glow-ring absolute -inset-0.5 rounded-[1.6rem] opacity-0 blur-md transition-opacity duration-200 group-hover:opacity-60" />
      <div className="relative h-full rounded-3xl bg-surface p-5">{children}</div>
    </div>
  );
}

function StatTile({ label, value, hint }) {
  return (
    <GlowCard>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-4xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </GlowCard>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <GlowCard className="h-full">
      <p className="font-display text-lg font-bold">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </GlowCard>
  );
}

function Donut({ slices, total, centerLabel }) {
  const [hover, setHover] = useState(null);
  const R = 62;
  const STROKE = 26;
  const C = 2 * Math.PI * R;
  const GAP = 3;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-8">
      <svg viewBox="0 0 180 180" className="h-44 w-44 shrink-0">
        {slices.map((s) => {
          const frac = total > 0 ? s.value / total : 0;
          const len = Math.max(frac * C - GAP, 0);
          const offset = -acc * C;
          acc += frac;
          return (
            <circle
              key={s.label}
              cx="90"
              cy="90"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={hover === s.label ? STROKE + 4 : STROKE}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={offset}
              transform="rotate(-90 90 90)"
              style={{ transition: "stroke-width 150ms" }}
              onMouseEnter={() => setHover(s.label)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
        <text x="90" y="87" textAnchor="middle" fill="#FFE0C4" fontSize="30" fontWeight="800" fontFamily="Baloo 2">
          {total}
        </text>
        <text x="90" y="105" textAnchor="middle" fill={AXIS_TEXT} fontSize="9" fontFamily="Poppins" letterSpacing="1.5">
          {centerLabel}
        </text>
      </svg>
      <div className="space-y-3">
        {slices.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3"
            onMouseEnter={() => setHover(s.label)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <div>
              <p className="text-sm font-semibold text-foreground">{s.label}</p>
              <p className="text-xs text-muted-foreground">
                {s.value} · {total > 0 ? Math.round((s.value / total) * 100) : 0}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function barPath(x, y, w, h, r) {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M ${x} ${y + h} L ${x} ${y + rr} Q ${x} ${y} ${x + rr} ${y} L ${x + w - rr} ${y} Q ${x + w} ${y} ${x + w} ${y + rr} L ${x + w} ${y + h} Z`;
}

function Bars({ data, height = 190 }) {
  const [hover, setHover] = useState(null);
  const W = 520;
  const PAD_L = 34;
  const PAD_B = 26;
  const PAD_T = 14;
  const plotW = W - PAD_L - 10;
  const plotH = height - PAD_B - PAD_T;
  const rawMax = Math.max(...data.map((d) => d.value), 0);
  const max = rawMax === 0 ? 1 : Math.ceil(rawMax / 4) * 4;
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const slot = plotW / data.length;
  const barW = Math.min(slot * 0.5, 42);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full">
      {ticks.map((t) => {
        const y = PAD_T + plotH - (t / max) * plotH;
        return (
          <g key={t}>
            <line x1={PAD_L} x2={W - 10} y1={y} y2={y} stroke={GRID_COLOR} strokeWidth="1" />
            <text x={PAD_L - 8} y={y + 3} textAnchor="end" fill={AXIS_TEXT} fontSize="10" fontFamily="Poppins">
              {t}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * plotH;
        const x = PAD_L + i * slot + (slot - barW) / 2;
        const y = PAD_T + plotH - h;
        return (
          <g key={d.label}>
            <rect
              x={PAD_L + i * slot}
              y={PAD_T}
              width={slot}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            <path
              d={barPath(x, y, barW, h, 5)}
              fill={BAR_COLOR}
              opacity={hover === null || hover === i ? 1 : 0.45}
              style={{ transition: "opacity 150ms" }}
              pointerEvents="none"
            />
            {hover === i && d.value > 0 && (
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fill="#FFE0C4" fontSize="12" fontWeight="700" fontFamily="Poppins">
                {d.value}
              </text>
            )}
            <text
              x={PAD_L + i * slot + slot / 2}
              y={height - 8}
              textAnchor="middle"
              fill={hover === i ? "#FFE0C4" : AXIS_TEXT}
              fontSize="10"
              fontFamily="Poppins"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* Barres horizontales survolables — registre des récompenses */
function HBars({ data }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div
          key={d.key}
          className="flex items-center gap-4"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        >
          <p
            className={[
              "w-44 shrink-0 truncate text-sm transition-colors duration-150",
              hover === i ? "font-semibold text-foreground" : "text-muted-foreground",
            ].join(" ")}
            title={d.label}
          >
            <span className="mr-2 text-[10px] font-bold text-muted-foreground">n°{d.visit}</span>
            {d.label}
          </p>
          <div className="relative h-5 flex-1">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: BAR_COLOR,
                opacity: hover === null || hover === i ? 1 : 0.45,
              }}
            />
          </div>
          <span
            className={[
              "w-8 shrink-0 text-right text-sm font-bold tabular-nums transition-colors duration-150",
              hover === i ? "text-foreground" : "text-muted-foreground",
            ].join(" ")}
          >
            {d.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ============================== ACCÈS ADMIN ============================== */

function AdminGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => !!sessionStorage.getItem(ADMIN_PIN_KEY));
  const [pass, setPass] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      // Le PIN est vérifié EN BASE : un snapshot non-null = PIN correct.
      const snap = await adminSnapshot(pass);
      if (snap) {
        sessionStorage.setItem(ADMIN_PIN_KEY, pass);
        setUnlocked(true);
        return;
      }
    } catch (err) {
      /* traité comme un échec */
    } finally {
      setBusy(false);
    }
    setShake(true);
    setTimeout(() => {
      setShake(false);
      setPass("");
    }, 500);
  }

  if (unlocked) return children;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 font-sans text-foreground">
      <style>{ADMIN_STYLES}</style>
      <form onSubmit={submit} className={["w-full max-w-xs", shake ? "animate-shake-x" : ""].join(" ")}>
        <span
          aria-hidden="true"
          className="stamp-cream mx-auto block h-20 w-20"
          style={{ "--stamp-url": `url(${IMG_STAMP})` }}
        />
        <h1 className="mt-6 text-center font-display text-3xl font-extrabold">Espace équipe</h1>
        <p className="mt-1 text-center text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Mot de passe requis
        </p>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="••••"
          autoFocus
          className="mt-6 h-14 w-full rounded-2xl border-2 border-transparent bg-surface px-4 text-center font-display text-2xl tracking-[0.4em] text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/40 focus:border-foreground"
        />
        <button type="submit" disabled={busy} className={`${BTN} mt-4 w-full disabled:opacity-60`}>
          {busy ? "…" : "Entrer"}
        </button>
        <a
          href={BASE}
          className="mt-6 block text-center text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          Retour à l'app
        </a>
      </form>
    </div>
  );
}

function AdminShell({ active, children }) {
  const nav = [
    { key: "dash", label: "Tableau de bord", href: `${BASE}admin` },
    { key: "rewards", label: "Récompenses", href: `${BASE}admin/recompenses` },
    { key: "titles", label: "Titres", href: `${BASE}admin/titres` },
    { key: "wheel", label: "Roue du mois", href: `${BASE}roulette` },
    { key: "app", label: "App cliente", href: BASE },
  ];
  return (
    <AdminGate>
      <div className="min-h-screen bg-background font-sans text-foreground antialiased">
        <style>{ADMIN_STYLES}</style>
        <div className="mx-auto w-full max-w-5xl px-8 py-10">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src={IMG_LOGO} alt={`Pickel'z — ${TAGLINE}`} className="w-32" />
              <span className="rounded-full bg-surface px-4 py-1.5 font-display text-sm font-bold text-muted-foreground">
                Espace équipe
              </span>
            </div>
            <nav className="flex flex-wrap items-center gap-2">
              {nav.map((n) => (
                <a
                  key={n.key}
                  href={n.href}
                  className={[
                    "rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] transition-colors duration-150",
                    active === n.key
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground",
                  ].join(" ")}
                >
                  {n.label}
                </a>
              ))}
            </nav>
          </header>
          {children}
        </div>
      </div>
    </AdminGate>
  );
}

/* ============================== TABLEAU DE BORD ============================== */

export function AdminDashboard() {
  // Snapshot complet (PII incluse) via RPC protégée par PIN, rafraîchi périodiquement.
  const [db, setDb] = useState({ users: [], rewards: [], titles: [], cardSize: 50 });
  const [range, setRange] = useState(null); // {start, end} CalendarDate ou null = tout
  const [proofFilter, setProofFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const snap = await adminSnapshot(adminPin());
      if (snap) setDb(snap);
    } catch (err) {
      /* PIN révoqué / réseau : on garde l'affichage courant */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000); // pas de temps réel sur les tables PII
    return () => clearInterval(t);
  }, [refresh]);

  const users = db.users;
  const cardSize = db.cardSize;
  const rewards = useMemo(() => activeRewards(db.rewards), [db.rewards]);

  const inRange = useMemo(() => {
    if (!range || !range.start || !range.end) return () => true;
    const tz = getLocalTimeZone();
    const start = range.start.toDate(tz).getTime();
    const end = range.end.toDate(tz).getTime() + 86400000 - 1;
    return (iso) => {
      const t = new Date(iso).getTime();
      return t >= start && t <= end;
    };
  }, [range]);

  const stats = useMemo(() => {
    const all = users.flatMap((u) => u.history);
    const filtered = all.filter(
      (h) => inRange(h.date) && (proofFilter === "all" || h.type === proofFilter)
    );

    const now = new Date();
    const prevMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const activePrev = users.filter((u) => u.history.some((h) => isSameMonth(h.date, prevMonthRef)));
    const retained = activePrev.filter((u) => u.history.some((h) => isSameMonth(h.date)));
    const retentionRate =
      activePrev.length > 0 ? Math.round((retained.length / activePrev.length) * 100) : null;

    const withVisits = users.filter((u) => u.history.length >= 1);
    const returning = users.filter((u) => u.history.length >= 2);
    const returningRate =
      withVisits.length > 0 ? Math.round((returning.length / withVisits.length) * 100) : null;

    let gapSum = 0;
    let gapCount = 0;
    for (const u of users) {
      const dates = u.history.map((h) => new Date(h.date).getTime()).sort((a, b) => a - b);
      for (let i = 1; i < dates.length; i++) {
        gapSum += (dates[i] - dates[i - 1]) / 86400000;
        gapCount++;
      }
    }
    const avgReturnDays = gapCount > 0 ? Math.round((gapSum / gapCount) * 10) / 10 : null;

    const discountRewards = rewards.filter((r) => r.kind === "discount");
    const treatRewards = rewards.filter((r) => r.kind !== "discount");
    const discountsGiven = users.reduce(
      (n, u) => n + discountRewards.filter((r) => monthVisits(u, cardSize) >= r.visit).length,
      0
    );
    const treatsGiven = users.reduce(
      (n, u) => n + treatRewards.filter((r) => monthVisits(u, cardSize) >= r.visit).length,
      0
    );

    const instagram = filtered.filter((h) => h.type === "instagram").length;
    const google = filtered.filter((h) => h.type === "google").length;

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleDateString("fr-FR", { month: "short" }),
        value: all.filter(
          (h) => isSameMonth(h.date, d) && (proofFilter === "all" || h.type === proofFilter)
        ).length,
      });
    }

    const byTitle = db.titles.map((t) => ({
      label: t.label.split(" ")[0],
      value: users.filter((u) => getTitle(db.titles, monthVisits(u, cardSize)) === t.label).length,
    }));

    const rewardBars = rewards.map((r) => ({
      key: r.id,
      visit: r.visit,
      label: r.label,
      value: users.filter((u) => monthVisits(u, cardSize) >= r.visit).length,
    }));

    return {
      totalUsers: users.length,
      filteredVisits: filtered.length,
      visitsThisMonth: all.filter((h) => isSameMonth(h.date)).length,
      participants: users.filter((u) => u.history.some((h) => isSameMonth(h.date))).length,
      promoOptIns: users.filter((u) => u.promoOptIn).length,
      retentionRate,
      returningRate,
      returningCount: returning.length,
      avgReturnDays,
      discountsGiven,
      treatsGiven,
      instagram,
      google,
      months,
      byTitle,
      rewardBars,
    };
  }, [users, rewards, db.titles, inRange, proofFilter, cardSize]);

  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? users.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            (u.nickname || "").toLowerCase().includes(q) ||
            u.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
            (u.instagram || "").toLowerCase().includes(q.replace(/^@/, ""))
        )
      : users;
    return [...list].sort((a, b) => monthVisits(b, cardSize) - monthVisits(a, cardSize));
  }, [users, search, cardSize]);

  async function handleSeed() {
    setBusy(true);
    try {
      await adminSeed(adminPin());
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (
      !window.confirm(
        "Tout vider ? Clients, historiques, récompenses et titres personnalisés seront supprimés."
      )
    )
      return;
    setBusy(true);
    try {
      await adminClear(adminPin());
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell active="dash">
      {/* Filtres */}
      <section className="animate-fade-in-up mt-8 flex flex-wrap items-center gap-3">
        <DateRange value={range} onChange={setRange} />
        <div className="flex h-11 items-center rounded-full bg-surface p-1">
          {[
            { v: "all", label: "Tout" },
            { v: "instagram", label: "Instagram" },
            { v: "google", label: "Google" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setProofFilter(o.v)}
              className={[
                "h-full rounded-full px-4 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors duration-150",
                proofFilter === o.v
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleSeed}
            disabled={busy}
            className="h-11 rounded-full border-2 border-dashed border-muted-foreground/40 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground disabled:opacity-40"
          >
            {busy ? "…" : "Temp — Seed démo"}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={busy}
            className="h-11 rounded-full border-2 border-dashed border-muted-foreground/40 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground disabled:opacity-40"
          >
            {busy ? "…" : "Temp — Tout vider"}
          </button>
        </div>
      </section>

      {/* Indicateurs clés */}
      <section className="animate-fade-in-up mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Clients"
          value={stats.totalUsers}
          hint={`${stats.participants} actif${stats.participants > 1 ? "s" : ""} ce mois · ${stats.promoOptIns} opt-in promos`}
        />
        <StatTile
          label="Visites (période)"
          value={stats.filteredVisits}
          hint={`${stats.visitsThisMonth} ce mois-ci, tous types`}
        />
        <StatTile
          label="Remises débloquées"
          value={stats.discountsGiven}
          hint="Sur le parcours du mois en cours"
        />
        <StatTile
          label="Gourmandises offertes"
          value={stats.treatsGiven}
          hint="Sodas, crêpes et milkshakes débloqués"
        />
      </section>

      {/* Fidélité & rétention */}
      <section className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Rétention mensuelle"
          value={stats.retentionRate === null ? "—" : `${stats.retentionRate}%`}
          hint="Clients du mois dernier revenus ce mois-ci"
        />
        <StatTile
          label="Clients récurrents"
          value={stats.returningRate === null ? "—" : `${stats.returningRate}%`}
          hint={`${stats.returningCount} client${stats.returningCount > 1 ? "s" : ""} avec 2 visites ou plus`}
        />
        <StatTile
          label="Retour moyen"
          value={stats.avgReturnDays === null ? "—" : `${stats.avgReturnDays} j`}
          hint="Délai moyen entre deux visites"
        />
        <StatTile label="Tirage du mois" value={stats.participants} hint="Participants à la roue en cours" />
      </section>

      {/* Graphiques */}
      <section className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <ChartCard title="Preuves de visite" subtitle="Répartition sur la période filtrée">
            <Donut
              total={stats.instagram + stats.google}
              centerLabel="PREUVES"
              slices={[
                { label: "Story Instagram", value: stats.instagram, color: CAT_INSTAGRAM },
                { label: "Avis Google", value: stats.google, color: CAT_GOOGLE },
              ]}
            />
          </ChartCard>
        </div>
        <div className="lg:col-span-7">
          <ChartCard title="Visites par mois" subtitle="6 derniers mois, filtre preuve appliqué">
            <Bars data={stats.months} />
          </ChartCard>
        </div>
      </section>

      <section className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <ChartCard title="Clients par titre" subtitle="Selon le parcours du mois en cours">
            <Bars data={stats.byTitle} height={210} />
          </ChartCard>
        </div>
        <div className="lg:col-span-7">
          <ChartCard
            title="Récompenses débloquées"
            subtitle="Nombre de clients ayant atteint chaque palier ce mois-ci"
          >
            <HBars data={stats.rewardBars} />
          </ChartCard>
        </div>
      </section>

      {/* Clients */}
      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-extrabold">Clients</h2>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher nom, surnom, téléphone, Instagram…"
            className="h-11 w-80 rounded-full border-2 border-transparent bg-surface px-5 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-foreground"
          />
        </div>
        {visibleUsers.length === 0 ? (
          <div className="rounded-3xl bg-surface px-8 py-12 text-center text-sm text-muted-foreground">
            {users.length === 0
              ? "Aucun client pour l'instant."
              : "Aucun résultat pour cette recherche."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl bg-surface">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-5 py-4 font-bold">Nom</th>
                  <th className="px-5 py-4 font-bold">Surnom</th>
                  <th className="px-5 py-4 font-bold">Titre</th>
                  <th className="px-5 py-4 text-right font-bold">Mois</th>
                  <th className="px-5 py-4 text-right font-bold">Total</th>
                  <th className="px-5 py-4 font-bold">Instagram</th>
                  <th className="px-5 py-4 text-right font-bold">Dernier passage</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u) => {
                  const last = u.history[u.history.length - 1];
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedUser(u)}
                      className="cursor-pointer border-b border-border/30 transition-colors duration-150 last:border-b-0 hover:bg-raised"
                    >
                      <td className="px-5 py-3.5 font-semibold">{u.name}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{u.nickname || "—"}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {getTitle(db.titles, monthVisits(u, cardSize))}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold tabular-nums">
                        {monthVisits(u, cardSize)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                        {u.history.length}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {u.instagram ? `@${u.instagram}` : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-muted-foreground">
                        {last ? formatDateFR(last.date) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Détail client */}
      {selectedUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-5">
          <div
            className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedUser(null)}
          />
          <div className="animate-fade-in-up relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-background p-6 ring-2 ring-border">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl font-extrabold leading-tight">
                  {selectedUser.name}
                </h2>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  {selectedUser.id}
                  {selectedUser.nickname ? ` — « ${selectedUser.nickname} »` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                aria-label="Fermer"
                className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors duration-150 hover:bg-surface hover:text-foreground"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-3">
              {[
                ["Téléphone", selectedUser.phone],
                ["Instagram", selectedUser.instagram ? `@${selectedUser.instagram}` : "—"],
                ["Titre", getTitle(db.titles, monthVisits(selectedUser, cardSize))],
                ["Parcours du mois", `${monthVisits(selectedUser, cardSize)} / ${cardSize}`],
                ["Visites totales", String(selectedUser.history.length)],
                ["Offres promos", selectedUser.promoOptIn ? "Acceptées" : "Refusées"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-surface p-4">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                    {k}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Récompenses débloquées ce mois-ci
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {rewards.filter((r) => monthVisits(selectedUser, cardSize) >= r.visit).length === 0 ? (
                  <span className="text-sm text-muted-foreground">Aucune pour l'instant.</span>
                ) : (
                  rewards
                    .filter((r) => monthVisits(selectedUser, cardSize) >= r.visit)
                    .map((r) => (
                      <span
                        key={r.id}
                        className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground"
                      >
                        {r.label}
                      </span>
                    ))
                )}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Historique complet — {selectedUser.history.length} visite
                {selectedUser.history.length > 1 ? "s" : ""}
              </p>
              {selectedUser.history.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Aucune visite enregistrée.</p>
              ) : (
                <div className="mt-2 overflow-hidden rounded-2xl bg-surface">
                  {[...selectedUser.history].reverse().map((h, idx) => (
                    <div
                      key={h.id}
                      className="flex items-baseline justify-between gap-4 px-4 py-3 [&+&]:border-t [&+&]:border-border/30"
                    >
                      <p className="text-sm">
                        <span className="mr-3 text-xs font-bold text-muted-foreground">
                          n°{selectedUser.history.length - idx}
                        </span>
                        {h.type === "instagram" ? "Story Instagram" : "Avis Google"}
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          équipe {h.serverCode}
                        </span>
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDateFR(h.date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

/* ============================== RÉCOMPENSES (CRUD) ============================== */

const EMPTY_REWARD = {
  id: "",
  visit: "",
  label: "",
  detail: "",
  kind: "discount",
  capped: false,
  activeFrom: "",
  activeTo: "",
};

export function AdminRewardsPage() {
  const { config, refresh } = useConfig();
  const db = config; // {rewards, titles, cardSize}
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState("");

  const sorted = [...db.rewards].sort((a, b) => a.visit - b.visit);

  async function bumpCard(delta) {
    const next = sanitizeCardSize(db.cardSize + delta);
    if (next === db.cardSize) return;
    try {
      await adminSetCardSize(adminPin(), next);
      refresh();
    } catch (err) {
      /* le prochain fetch corrigera */
    }
  }

  function openNew() {
    setFormError("");
    setEditing({ ...EMPTY_REWARD, id: `r-${Date.now()}` });
  }

  function openEdit(r) {
    setFormError("");
    setEditing({ ...r });
  }

  function set(field, value) {
    setEditing((prev) => ({ ...prev, [field]: value }));
    setFormError("");
  }

  async function handleSave(e) {
    e.preventDefault();
    const visit = Number(editing.visit);
    if (!Number.isInteger(visit) || visit < 1 || visit > db.cardSize) {
      setFormError(`Le palier doit être un entier entre 1 et ${db.cardSize} (taille de la carte).`);
      return;
    }
    if (db.rewards.some((r) => r.visit === visit && r.id !== editing.id)) {
      setFormError("Une récompense existe déjà sur ce palier.");
      return;
    }
    if (editing.label.trim().length < 2) {
      setFormError("Le nom de la récompense est obligatoire.");
      return;
    }
    if (editing.activeFrom && editing.activeTo && editing.activeFrom > editing.activeTo) {
      setFormError("La date de fin doit suivre la date de début.");
      return;
    }
    const clean = { ...editing, visit, label: editing.label.trim(), detail: editing.detail.trim() };
    try {
      await adminUpsertReward(adminPin(), clean);
      refresh();
      setEditing(null);
    } catch (err) {
      setFormError("Enregistrement échoué — réessayez.");
    }
  }

  async function handleDelete() {
    if (!editing) return;
    if (!window.confirm(`Supprimer « ${editing.label || "cette récompense"} » ?`)) return;
    try {
      await adminDeleteReward(adminPin(), editing.id);
      refresh();
      setEditing(null);
    } catch (err) {
      setFormError("Suppression échouée — réessayez.");
    }
  }

  return (
    <AdminShell active="rewards">
      <section className="animate-fade-in-up mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-extrabold">Récompenses du parcours</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Modifiez les paliers, les gains et leurs périodes de validité — l'app cliente se met à
              jour instantanément.
            </p>
          </div>
          <button type="button" onClick={openNew} className={`${BTN} flex items-center gap-2`}>
            <Plus size={18} strokeWidth={2.5} />
            Ajouter
          </button>
        </div>

        {/* Taille de la carte — décidée par l'admin */}
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-3xl bg-surface p-5">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">Taille de la carte</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Nombre de tampons à collecter chaque mois. Multiple de {CARD_STEP} (grille à 5
              colonnes), de {CARD_STEP} à {MAX_CARD_SIZE}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Diminuer"
              onClick={() => bumpCard(-CARD_STEP)}
              disabled={db.cardSize <= CARD_STEP}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-deep font-display text-2xl font-bold text-foreground transition-colors duration-150 hover:bg-raised active:scale-95 disabled:opacity-30"
            >
              −
            </button>
            <div className="flex h-12 w-20 items-center justify-center rounded-2xl bg-accent font-display text-2xl font-extrabold tabular-nums text-accent-foreground">
              {db.cardSize}
            </div>
            <button
              type="button"
              aria-label="Augmenter"
              onClick={() => bumpCard(CARD_STEP)}
              disabled={db.cardSize >= MAX_CARD_SIZE}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-deep font-display text-2xl font-bold text-foreground transition-colors duration-150 hover:bg-raised active:scale-95 disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-3xl bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-5 py-4 font-bold">Palier</th>
                <th className="px-5 py-4 font-bold">Récompense</th>
                <th className="px-5 py-4 font-bold">Type</th>
                <th className="px-5 py-4 font-bold">Plafond</th>
                <th className="px-5 py-4 font-bold">Validité</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const outOfCard = r.visit > db.cardSize;
                return (
                <tr
                  key={r.id}
                  onClick={() => openEdit(r)}
                  className={[
                    "cursor-pointer border-b border-border/30 transition-colors duration-150 last:border-b-0 hover:bg-raised",
                    outOfCard ? "opacity-45" : "",
                  ].join(" ")}
                >
                  <td className="px-5 py-4">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent font-display text-base font-extrabold tabular-nums text-accent-foreground">
                      {r.visit}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-display text-base font-bold">
                      {r.label}
                      {outOfCard && (
                        <span className="ml-2 rounded-full bg-surface-deep px-2 py-0.5 align-middle text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                          Hors carte
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.detail}</p>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {r.kind === "discount" ? "Remise" : "Gourmandise"}
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {r.kind === "discount" ? (r.capped ? "10 DT" : "Sans plafond") : "—"}
                  </td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    {r.activeFrom || r.activeTo
                      ? `${r.activeFrom || "…"} → ${r.activeTo || "…"}`
                      : "Permanente"}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-5">
          <div
            className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setEditing(null)}
          />
          <form
            onSubmit={handleSave}
            className="animate-fade-in-up relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-background p-6 ring-2 ring-border"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl font-extrabold">
                {db.rewards.some((r) => r.id === editing.id) ? "Modifier" : "Nouvelle récompense"}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Fermer"
                className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors duration-150 hover:bg-surface hover:text-foreground"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Palier (visite n°)</label>
                  <input
                    type="number"
                    min="1"
                    max={db.cardSize}
                    value={editing.visit}
                    onChange={(e) => set("visit", e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className={LABEL}>Type</label>
                  <select
                    value={editing.kind}
                    onChange={(e) => set("kind", e.target.value)}
                    className={INPUT}
                  >
                    <option value="discount">Remise</option>
                    <option value="treat">Gourmandise</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={LABEL}>Nom</label>
                <input
                  type="text"
                  placeholder="20% de réduction"
                  value={editing.label}
                  onChange={(e) => set("label", e.target.value)}
                  className={INPUT}
                />
              </div>
              <div>
                <label className={LABEL}>Détail</label>
                <input
                  type="text"
                  placeholder="Plafonnée à 10 DT"
                  value={editing.detail}
                  onChange={(e) => set("detail", e.target.value)}
                  className={INPUT}
                />
              </div>
              {editing.kind === "discount" && (
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-surface p-4">
                  <input
                    type="checkbox"
                    checked={editing.capped}
                    onChange={(e) => set("capped", e.target.checked)}
                    className="h-5 w-5 cursor-pointer appearance-none rounded-md bg-surface-deep ring-2 ring-border transition-colors duration-150 checked:bg-accent checked:ring-accent"
                  />
                  <span className="text-sm text-muted-foreground">Plafonnée à 10 DT</span>
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Active du</label>
                  <input
                    type="date"
                    value={editing.activeFrom}
                    onChange={(e) => set("activeFrom", e.target.value)}
                    className={`${INPUT} [color-scheme:dark]`}
                  />
                </div>
                <div>
                  <label className={LABEL}>au</label>
                  <input
                    type="date"
                    value={editing.activeTo}
                    onChange={(e) => set("activeTo", e.target.value)}
                    className={`${INPUT} [color-scheme:dark]`}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Laissez les dates vides pour une récompense permanente.
              </p>
              {formError && <p className="animate-fade-in text-sm font-medium">{formError}</p>}
              <div className="flex items-center gap-3 pt-1">
                <button type="submit" className={`${BTN} flex-1`}>
                  Enregistrer
                </button>
                {db.rewards.some((r) => r.id === editing.id) && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    aria-label="Supprimer"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-foreground/60 text-foreground transition-colors duration-150 hover:bg-foreground hover:text-accent-foreground active:scale-95"
                  >
                    <Trash2 size={17} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  );
}

/* ============================== TITRES (EN CASCADE) ============================== */

export function AdminTitlesPage() {
  const { config, refresh } = useConfig();
  const db = config; // {rewards, titles, cardSize}
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Amorce le brouillon une fois les titres chargés depuis Supabase.
  useEffect(() => {
    if (draft === null && !config.loading) {
      setDraft([...db.titles].sort((a, b) => a.min - b.min));
    }
  }, [config.loading, db.titles, draft]);

  function setRow(i, field, value) {
    setDraft((prev) => (prev || []).map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
    setError("");
    setSaved(false);
  }

  function addRow() {
    setDraft((prev) => {
      const list = prev || [];
      const lastMin = list.length > 0 ? Number(list[list.length - 1].min) : 0;
      return [...list, { min: lastMin + 10, label: "" }];
    });
    setSaved(false);
  }

  function removeRow(i) {
    setDraft((prev) => (prev || []).filter((_, idx) => idx !== i));
    setError("");
    setSaved(false);
  }

  async function handleSave() {
    if (!draft || draft.length === 0) {
      setError("Il faut au moins un titre.");
      return;
    }
    const rows = draft.map((t) => ({ min: Number(t.min), label: t.label.trim() }));
    if (rows[0].min !== 0) {
      setError("Le premier palier doit commencer à 0 visite.");
      return;
    }
    for (let i = 0; i < rows.length; i++) {
      if (!Number.isInteger(rows[i].min) || rows[i].min < 0 || rows[i].min > db.cardSize) {
        setError(`Palier n°${i + 1} : le seuil doit être entre 0 et ${db.cardSize} (taille de la carte).`);
        return;
      }
      if (rows[i].label.length < 2) {
        setError(`Palier n°${i + 1} : le titre est obligatoire.`);
        return;
      }
      if (i > 0 && rows[i].min <= rows[i - 1].min) {
        setError(
          `La cascade doit monter : le palier n°${i + 1} doit dépasser ${rows[i - 1].min} visites.`
        );
        return;
      }
    }
    try {
      await adminSaveTitles(adminPin(), rows);
      refresh();
      setError("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError("Enregistrement échoué — réessayez.");
    }
  }

  return (
    <AdminShell active="titles">
      <section className="animate-fade-in-up mt-8 max-w-2xl">
        <h2 className="font-display text-3xl font-extrabold">Titres des clients</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Les titres se débloquent en cascade au fil des visites du mois : chaque seuil doit être
          plus haut que le précédent.
        </p>

        <div className="mt-6 space-y-2">
          {(draft || []).map((t, i) => (
            <div key={i} className="flex items-center gap-3" style={{ paddingLeft: `${i * 20}px` }}>
              <div
                className="h-1 w-4 shrink-0 rounded-full bg-accent"
                style={{ opacity: i === 0 ? 0 : 1 }}
              />
              <input
                type="number"
                min="0"
                max={db.cardSize}
                value={t.min}
                disabled={i === 0}
                onChange={(e) => setRow(i, "min", e.target.value)}
                className="h-12 w-24 rounded-2xl border-2 border-transparent bg-surface px-3 text-center text-sm font-bold tabular-nums text-foreground outline-none transition-colors duration-150 focus:border-foreground disabled:opacity-50"
              />
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                visites →
              </span>
              <input
                type="text"
                value={t.label}
                placeholder="Nom du titre"
                onChange={(e) => setRow(i, "label", e.target.value)}
                className="h-12 min-w-0 flex-1 rounded-2xl border-2 border-transparent bg-surface px-4 font-display text-base font-bold text-foreground outline-none transition-colors duration-150 placeholder:font-sans placeholder:font-normal placeholder:text-muted-foreground/60 focus:border-foreground"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={i === 0 && draft.length === 1}
                aria-label="Supprimer ce palier"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface text-muted-foreground transition-colors duration-150 hover:bg-raised hover:text-foreground disabled:opacity-30"
              >
                <Trash2 size={16} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addRow}
            className="flex h-12 items-center gap-2 rounded-full border-2 border-foreground px-5 font-display text-base font-extrabold text-foreground transition-colors duration-150 hover:bg-foreground hover:text-accent-foreground active:scale-[0.97]"
          >
            <Plus size={17} strokeWidth={2.5} />
            Ajouter un palier
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={
              saved
                ? "h-12 rounded-full bg-surface px-8 font-display text-base font-extrabold text-foreground"
                : `${BTN} px-8`
            }
          >
            {saved ? "Enregistré !" : "Enregistrer la cascade"}
          </button>
        </div>
        {error && <p className="animate-fade-in mt-3 text-sm font-medium">{error}</p>}
      </section>
    </AdminShell>
  );
}
