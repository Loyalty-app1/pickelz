import React, { useState, useEffect, useMemo } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { getLocalTimeZone } from "@internationalized/date";
import DateRange from "./DateRange.jsx";
import {
  ADMIN_PASS,
  MAX_VISITS,
  IMG_STAMP,
  BASE,
  loadDB,
  saveDB,
  seedDemoDB,
  clearDB,
  monthVisits,
  activeRewards,
  getTitle,
  formatDateFR,
  isSameMonth,
} from "./store.js";

// Palette catégorielle validée (dataviz : luminance, chroma, CVD, contraste — OK sur #0F0F0F)
const CAT_INSTAGRAM = "#D96C7C";
const CAT_GOOGLE = "#4189BF";
const BAR_COLOR = "#D96C7C";
const GRID_COLOR = "#262626";

const NOISE_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const ADMIN_STYLES = `
  @property --glow-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
  @keyframes glowSpin { to { --glow-angle: 360deg; } }
  .glow-ring {
    background: conic-gradient(
      from var(--glow-angle),
      transparent 0deg,
      #7d2231 70deg,
      #d96c7c 120deg,
      #7d2231 170deg,
      transparent 240deg
    );
    animation: glowSpin 2.5s linear infinite;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes shakeX {
    10%, 90% { transform: translateX(-2px); }
    20%, 80% { transform: translateX(4px); }
    30%, 50%, 70% { transform: translateX(-6px); }
    40%, 60% { transform: translateX(6px); }
  }
  .animate-fade-in { animation: fadeIn 0.2s ease-out both; }
  .animate-fade-in-up { animation: fadeInUp 0.4s cubic-bezier(0.25, 0, 0, 1) both; }
  .animate-shake-x { animation: shakeX 0.5s ease-in-out both; }
`;

/* Effet de bordure lumineuse au survol — même animation que les cases récompense */
function GlowCard({ children, className = "" }) {
  return (
    <div className={`group relative ${className}`}>
      <div className="glow-ring absolute -inset-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="glow-ring absolute -inset-0.5 opacity-0 blur-md transition-opacity duration-200 group-hover:opacity-60" />
      <div className="relative h-full border border-border bg-card p-5">{children}</div>
    </div>
  );
}

function StatTile({ label, value, hint }) {
  return (
    <GlowCard>
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-4xl font-black leading-none tracking-[-0.04em] tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </GlowCard>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <GlowCard className="h-full">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
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
    <div className="flex items-center gap-8">
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
        <text x="90" y="86" textAnchor="middle" fill="#FAFAFA" fontSize="30" fontWeight="900" fontFamily="Inter Tight">
          {total}
        </text>
        <text x="90" y="104" textAnchor="middle" fill="#737373" fontSize="10" fontFamily="JetBrains Mono" letterSpacing="1">
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
            <span className="h-3 w-3 shrink-0" style={{ backgroundColor: s.color }} />
            <div>
              <p className="text-sm font-semibold text-foreground">{s.label}</p>
              <p className="font-mono text-xs text-muted-foreground">
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
  const PAD_L = 36;
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
            <text x={PAD_L - 8} y={y + 3} textAnchor="end" fill="#737373" fontSize="10" fontFamily="JetBrains Mono">
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
              d={barPath(x, y, barW, h, 4)}
              fill={BAR_COLOR}
              opacity={hover === null || hover === i ? 1 : 0.45}
              style={{ transition: "opacity 150ms" }}
              pointerEvents="none"
            />
            {hover === i && d.value > 0 && (
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fill="#FAFAFA" fontSize="12" fontWeight="700" fontFamily="JetBrains Mono">
                {d.value}
              </text>
            )}
            <text
              x={PAD_L + i * slot + slot / 2}
              y={height - 8}
              textAnchor="middle"
              fill={hover === i ? "#FAFAFA" : "#737373"}
              fontSize="10"
              fontFamily="JetBrains Mono"
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
            <span className="mr-2 font-mono text-[10px] text-muted-foreground">
              n°{String(d.visit).padStart(2, "0")}
            </span>
            {d.label}
          </p>
          <div className="relative h-5 flex-1">
            <div
              className="absolute inset-y-0 left-0 rounded-r-[4px] transition-all duration-500"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: BAR_COLOR,
                opacity: hover === null || hover === i ? 1 : 0.45,
              }}
            />
          </div>
          <span
            className={[
              "w-8 shrink-0 text-right font-mono text-sm tabular-nums transition-colors duration-150",
              hover === i ? "font-bold text-accent-bright" : "text-muted-foreground",
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
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem("tfc_admin") === "1");
  const [pass, setPass] = useState("");
  const [shake, setShake] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (pass === ADMIN_PASS) {
      sessionStorage.setItem("tfc_admin", "1");
      setUnlocked(true);
    } else {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPass("");
      }, 500);
    }
  }

  if (unlocked) return children;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <style>{ADMIN_STYLES}</style>
      <form onSubmit={submit} className={["w-full max-w-xs", shake ? "animate-shake-x" : ""].join(" ")}>
        <img src={IMG_STAMP} alt="" className="mx-auto h-16 w-16 [filter:invert(1)] mix-blend-screen opacity-90" />
        <h1 className="mt-6 text-center text-2xl font-black uppercase tracking-[-0.04em]">
          Espace équipe
        </h1>
        <p className="mt-2 text-center font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
          Mot de passe requis
        </p>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="••••"
          autoFocus
          className="mt-6 h-14 w-full border border-border bg-input px-4 text-center font-mono text-xl tracking-[0.4em] text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/40 focus:border-accent-bright"
        />
        <button
          type="submit"
          className="mt-4 h-14 w-full bg-accent text-sm font-semibold uppercase tracking-[0.1em] text-accent-foreground transition-colors duration-150 hover:bg-[#93293a] active:translate-y-px"
        >
          Entrer
        </button>
        <a
          href={BASE}
          className="mt-6 block text-center font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
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
      <div className="min-h-screen bg-background font-sans text-foreground antialiased [letter-spacing:-0.01em]">
        <style>{ADMIN_STYLES}</style>
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[100] opacity-[0.015]"
          style={{ backgroundImage: NOISE_URL }}
        />
        <div className="mx-auto w-full max-w-5xl px-8 py-10">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <img src={IMG_STAMP} alt="" className="h-14 w-14 [filter:invert(1)] mix-blend-screen opacity-90" />
              <div>
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  The First — Coffee & Resto
                </p>
                <h1 className="text-3xl font-black uppercase leading-tight tracking-[-0.04em]">
                  Espace équipe
                </h1>
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-5">
              {nav.map((n) => (
                <a
                  key={n.key}
                  href={n.href}
                  className={[
                    "group relative py-2 font-mono text-xs font-medium uppercase tracking-[0.15em] transition-colors duration-150",
                    active === n.key
                      ? "text-accent-bright"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {n.label}
                  <span
                    className={[
                      "absolute bottom-0 left-0 h-0.5 w-full origin-left bg-accent-bright transition-transform duration-150",
                      active === n.key ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                    ].join(" ")}
                  />
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
  const [db, setDb] = useState(loadDB);
  const [range, setRange] = useState(null); // {start, end} CalendarDate ou null = tout
  const [proofFilter, setProofFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    saveDB(db);
  }, [db]);

  const users = db.users;
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

    // Intervalle moyen entre deux visites consécutives (tous clients confondus)
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
      (n, u) => n + discountRewards.filter((r) => monthVisits(u) >= r.visit).length,
      0
    );
    const treatsGiven = users.reduce(
      (n, u) => n + treatRewards.filter((r) => monthVisits(u) >= r.visit).length,
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
      value: users.filter((u) => getTitle(db.titles, monthVisits(u)) === t.label).length,
    }));

    const rewardBars = rewards.map((r) => ({
      key: r.id,
      visit: r.visit,
      label: r.label,
      value: users.filter((u) => monthVisits(u) >= r.visit).length,
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
  }, [users, rewards, db.titles, inRange, proofFilter]);

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
    return [...list].sort((a, b) => monthVisits(b) - monthVisits(a));
  }, [users, search]);

  function handleSeed() {
    setDb(seedDemoDB());
  }

  function handleClear() {
    if (window.confirm("Tout vider ? Clients, historiques, récompenses et titres personnalisés seront supprimés.")) {
      setDb(clearDB());
    }
  }

  return (
    <AdminShell active="dash">
      {/* Filtres */}
      <section className="animate-fade-in-up mt-8 flex flex-wrap items-center gap-3">
        <DateRange value={range} onChange={setRange} />
        <div className="flex h-11 items-center border border-border bg-input">
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
                "h-full px-4 font-mono text-[10px] font-medium uppercase tracking-[0.15em] transition-colors duration-150",
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
            className="h-11 border border-dashed border-muted-foreground/50 px-4 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground"
          >
            Temp — Seed démo
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="h-11 border border-dashed border-accent-bright/60 px-4 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-accent-bright transition-colors duration-150 hover:border-accent-bright hover:bg-accent/10"
          >
            Temp — Tout vider
          </button>
        </div>
      </section>

      {/* Indicateurs clés */}
      <section className="animate-fade-in-up mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Clients" value={stats.totalUsers} hint={`${stats.participants} actif${stats.participants > 1 ? "s" : ""} ce mois · ${stats.promoOptIns} opt-in promos`} />
        <StatTile label="Visites (période)" value={stats.filteredVisits} hint={`${stats.visitsThisMonth} ce mois-ci, tous types`} />
        <StatTile
          label="Remises débloquées"
          value={stats.discountsGiven}
          hint="Sur le parcours du mois en cours"
        />
        <StatTile label="Gourmandises offertes" value={stats.treatsGiven} hint="Sodas, crêpes et frappuccinos débloqués" />
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
        <StatTile
          label="Tirage du mois"
          value={stats.participants}
          hint="Participants à la roue en cours"
        />
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
          <ChartCard title="Récompenses débloquées" subtitle="Nombre de clients ayant atteint chaque palier ce mois-ci">
            <HBars data={stats.rewardBars} />
          </ChartCard>
        </div>
      </section>

      {/* Clients */}
      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Clients — cliquez pour le détail
          </h2>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher nom, téléphone, Instagram…"
            className="h-11 w-80 border border-border bg-input px-4 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-accent-bright"
          />
        </div>
        {visibleUsers.length === 0 ? (
          <div className="border border-border px-8 py-12 text-center text-sm text-muted-foreground">
            {users.length === 0 ? "Aucun client pour l'instant." : "Aucun résultat pour cette recherche."}
          </div>
        ) : (
          <div className="overflow-x-auto border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium">Surnom</th>
                  <th className="px-4 py-3 font-medium">Titre</th>
                  <th className="px-4 py-3 text-right font-medium">Mois</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Instagram</th>
                  <th className="px-4 py-3 text-right font-medium">Dernier passage</th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((u) => {
                  const last = u.history[u.history.length - 1];
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedUser(u)}
                      className="cursor-pointer border-b border-border transition-colors duration-150 last:border-b-0 hover:bg-muted"
                    >
                      <td className="px-4 py-3 font-semibold">{u.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.nickname || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {getTitle(db.titles, monthVisits(u))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{monthVisits(u)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                        {u.history.length}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.instagram ? `@${u.instagram}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
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
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
          <div className="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
          <div className="animate-fade-in-up relative max-h-[85vh] w-full max-w-lg overflow-y-auto border border-border bg-card p-6">
            <div className="absolute left-6 top-0 h-1 w-16 bg-accent" />
            <div className="flex items-start justify-between pt-2">
              <div>
                <h2 className="text-2xl font-black uppercase leading-tight tracking-[-0.04em]">
                  {selectedUser.name}
                </h2>
                <p className="mt-1 font-mono text-xs font-medium tracking-[0.15em] text-accent-bright">
                  {selectedUser.id}
                  {selectedUser.nickname ? ` — « ${selectedUser.nickname} »` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                aria-label="Fermer"
                className="p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Téléphone</dt>
                <dd className="mt-1 text-sm font-semibold">{selectedUser.phone}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Instagram</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {selectedUser.instagram ? `@${selectedUser.instagram}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Titre</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {getTitle(db.titles, monthVisits(selectedUser))}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Parcours du mois</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums">
                  {monthVisits(selectedUser)} / {MAX_VISITS}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Visites totales</dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums">{selectedUser.history.length}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Offres promos</dt>
                <dd className="mt-1 text-sm font-semibold">
                  {selectedUser.promoOptIn ? "Acceptées" : "Refusées"}
                </dd>
              </div>
            </dl>

            <div className="mt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Récompenses débloquées ce mois-ci
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {rewards.filter((r) => monthVisits(selectedUser) >= r.visit).length === 0 ? (
                  <span className="text-sm text-muted-foreground">Aucune pour l'instant.</span>
                ) : (
                  rewards
                    .filter((r) => monthVisits(selectedUser) >= r.visit)
                    .map((r) => (
                      <span key={r.id} className="border border-accent-bright px-2.5 py-1 text-xs font-semibold text-accent-bright">
                        {r.label}
                      </span>
                    ))
                )}
              </div>
            </div>

            <div className="mt-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Historique complet — {selectedUser.history.length} visite{selectedUser.history.length > 1 ? "s" : ""}
              </p>
              {selectedUser.history.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Aucune visite enregistrée.</p>
              ) : (
                <div className="mt-2">
                  {[...selectedUser.history].reverse().map((h, idx) => (
                    <div key={h.id} className="flex items-baseline justify-between gap-4 border-t border-border py-2.5">
                      <p className="text-sm">
                        <span className="mr-3 font-mono text-xs text-muted-foreground">
                          n°{selectedUser.history.length - idx}
                        </span>
                        {h.type === "instagram" ? "Story Instagram" : "Avis Google"}
                        <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                          serveur {h.serverCode}
                        </span>
                      </p>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
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
  const [db, setDb] = useState(loadDB);
  const [editing, setEditing] = useState(null); // objet récompense en cours d'édition
  const [formError, setFormError] = useState("");

  useEffect(() => {
    saveDB(db);
  }, [db]);

  const sorted = [...db.rewards].sort((a, b) => a.visit - b.visit);

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

  function handleSave(e) {
    e.preventDefault();
    const visit = Number(editing.visit);
    if (!Number.isInteger(visit) || visit < 1 || visit > MAX_VISITS) {
      setFormError(`Le palier doit être un entier entre 1 et ${MAX_VISITS}.`);
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
    const clean = {
      ...editing,
      visit,
      label: editing.label.trim(),
      detail: editing.detail.trim(),
    };
    setDb((prev) => {
      const exists = prev.rewards.some((r) => r.id === clean.id);
      return {
        ...prev,
        rewards: exists
          ? prev.rewards.map((r) => (r.id === clean.id ? clean : r))
          : [...prev.rewards, clean],
      };
    });
    setEditing(null);
  }

  function handleDelete() {
    if (!editing) return;
    if (window.confirm(`Supprimer « ${editing.label || "cette récompense"} » ?`)) {
      setDb((prev) => ({ ...prev, rewards: prev.rewards.filter((r) => r.id !== editing.id) }));
      setEditing(null);
    }
  }

  const inputClass =
    "h-12 w-full border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-accent-bright";

  return (
    <AdminShell active="rewards">
      <section className="animate-fade-in-up mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black uppercase tracking-[-0.04em]">Récompenses du parcours</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Modifiez les paliers, les gains et leurs périodes de validité — l'app cliente se met à
              jour instantanément.
            </p>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="flex h-12 items-center gap-2 bg-accent px-5 text-sm font-semibold uppercase tracking-[0.1em] text-accent-foreground transition-colors duration-150 hover:bg-[#93293a] active:translate-y-px"
          >
            <Plus size={16} strokeWidth={1.5} />
            Ajouter
          </button>
        </div>

        <div className="mt-6 overflow-x-auto border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                <th className="px-4 py-3 font-medium">Palier</th>
                <th className="px-4 py-3 font-medium">Récompense</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Plafond</th>
                <th className="px-4 py-3 font-medium">Validité</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openEdit(r)}
                  className="cursor-pointer border-b border-border transition-colors duration-150 last:border-b-0 hover:bg-muted"
                >
                  <td className="px-4 py-3 font-mono text-lg font-bold tabular-nums text-accent-bright">
                    {String(r.visit).padStart(2, "0")}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.detail}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.kind === "discount" ? "Remise" : "Gourmandise"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.kind === "discount" ? (r.capped ? "10 DT" : "Sans plafond") : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {r.activeFrom || r.activeTo
                      ? `${r.activeFrom || "…"} → ${r.activeTo || "…"}`
                      : "Permanente"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
          <div className="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <form
            onSubmit={handleSave}
            className="animate-fade-in-up relative max-h-[90vh] w-full max-w-md overflow-y-auto border border-border bg-card p-6"
          >
            <div className="absolute left-6 top-0 h-1 w-16 bg-accent" />
            <div className="mb-5 flex items-start justify-between pt-2">
              <h2 className="text-xl font-black uppercase tracking-[-0.04em]">
                {db.rewards.some((r) => r.id === editing.id) ? "Modifier" : "Nouvelle récompense"}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Fermer"
                className="p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Palier (visite n°)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={MAX_VISITS}
                    value={editing.visit}
                    onChange={(e) => set("visit", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Type
                  </label>
                  <select
                    value={editing.kind}
                    onChange={(e) => set("kind", e.target.value)}
                    className={inputClass}
                  >
                    <option value="discount">Remise</option>
                    <option value="treat">Gourmandise</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Nom
                </label>
                <input
                  type="text"
                  placeholder="20% de réduction"
                  value={editing.label}
                  onChange={(e) => set("label", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Détail
                </label>
                <input
                  type="text"
                  placeholder="Plafonnée à 10 DT"
                  value={editing.detail}
                  onChange={(e) => set("detail", e.target.value)}
                  className={inputClass}
                />
              </div>
              {editing.kind === "discount" && (
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={editing.capped}
                    onChange={(e) => set("capped", e.target.checked)}
                    className="h-4 w-4 cursor-pointer appearance-none border border-border bg-input transition-colors duration-150 checked:border-accent-bright checked:bg-accent"
                  />
                  <span className="text-sm text-muted-foreground">Plafonnée à 10 DT</span>
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Active du
                  </label>
                  <input
                    type="date"
                    value={editing.activeFrom}
                    onChange={(e) => set("activeFrom", e.target.value)}
                    className={`${inputClass} [color-scheme:dark]`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    au
                  </label>
                  <input
                    type="date"
                    value={editing.activeTo}
                    onChange={(e) => set("activeTo", e.target.value)}
                    className={`${inputClass} [color-scheme:dark]`}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Laissez les dates vides pour une récompense permanente.
              </p>
              {formError && <p className="animate-fade-in text-sm text-accent-bright">{formError}</p>}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="h-12 flex-1 bg-accent text-sm font-semibold uppercase tracking-[0.1em] text-accent-foreground transition-colors duration-150 hover:bg-[#93293a] active:translate-y-px"
                >
                  Enregistrer
                </button>
                {db.rewards.some((r) => r.id === editing.id) && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    aria-label="Supprimer"
                    className="flex h-12 w-12 items-center justify-center border border-accent-bright/60 text-accent-bright transition-colors duration-150 hover:bg-accent/10 active:translate-y-px"
                  >
                    <Trash2 size={16} strokeWidth={1.5} />
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
  const [db, setDb] = useState(loadDB);
  const [draft, setDraft] = useState(() => [...loadDB().titles].sort((a, b) => a.min - b.min));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    saveDB(db);
  }, [db]);

  function setRow(i, field, value) {
    setDraft((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
    setError("");
    setSaved(false);
  }

  function addRow() {
    const lastMin = draft.length > 0 ? Number(draft[draft.length - 1].min) : 0;
    setDraft((prev) => [...prev, { min: lastMin + 10, label: "" }]);
    setSaved(false);
  }

  function removeRow(i) {
    setDraft((prev) => prev.filter((_, idx) => idx !== i));
    setError("");
    setSaved(false);
  }

  function handleSave() {
    if (draft.length === 0) {
      setError("Il faut au moins un titre.");
      return;
    }
    const rows = draft.map((t) => ({ min: Number(t.min), label: t.label.trim() }));
    if (rows[0].min !== 0) {
      setError("Le premier palier doit commencer à 0 visite.");
      return;
    }
    for (let i = 0; i < rows.length; i++) {
      if (!Number.isInteger(rows[i].min) || rows[i].min < 0 || rows[i].min > MAX_VISITS) {
        setError(`Palier n°${i + 1} : le seuil doit être entre 0 et ${MAX_VISITS}.`);
        return;
      }
      if (rows[i].label.length < 2) {
        setError(`Palier n°${i + 1} : le titre est obligatoire.`);
        return;
      }
      if (i > 0 && rows[i].min <= rows[i - 1].min) {
        setError(`La cascade doit monter : le palier n°${i + 1} doit dépasser ${rows[i - 1].min} visites.`);
        return;
      }
    }
    setDb((prev) => ({ ...prev, titles: rows }));
    setError("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <AdminShell active="titles">
      <section className="animate-fade-in-up mt-8 max-w-2xl">
        <h2 className="text-xl font-black uppercase tracking-[-0.04em]">Titres des clients</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Les titres se débloquent en cascade au fil des visites du mois : chaque seuil doit être
          plus haut que le précédent.
        </p>

        <div className="mt-6 space-y-2">
          {draft.map((t, i) => (
            <div key={i} className="flex items-center gap-3" style={{ paddingLeft: `${i * 20}px` }}>
              <div className="h-px w-4 shrink-0 bg-accent" style={{ opacity: i === 0 ? 0 : 1 }} />
              <input
                type="number"
                min="0"
                max={MAX_VISITS}
                value={t.min}
                disabled={i === 0}
                onChange={(e) => setRow(i, "min", e.target.value)}
                className="h-12 w-24 border border-border bg-input px-3 text-center font-mono text-sm tabular-nums text-foreground outline-none transition-colors duration-150 focus:border-accent-bright disabled:opacity-50"
              />
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                visites →
              </span>
              <input
                type="text"
                value={t.label}
                placeholder="Nom du titre"
                onChange={(e) => setRow(i, "label", e.target.value)}
                className="h-12 min-w-0 flex-1 border border-border bg-input px-4 text-sm font-semibold text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-accent-bright"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={i === 0 && draft.length === 1}
                aria-label="Supprimer ce palier"
                className="flex h-12 w-12 shrink-0 items-center justify-center border border-border text-muted-foreground transition-colors duration-150 hover:border-accent-bright hover:text-accent-bright disabled:opacity-30"
              >
                <Trash2 size={15} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={addRow}
            className="flex h-12 items-center gap-2 border border-foreground px-5 text-sm font-semibold uppercase tracking-[0.1em] text-foreground transition-colors duration-150 hover:bg-foreground hover:text-background active:translate-y-px"
          >
            <Plus size={15} strokeWidth={1.5} />
            Ajouter un palier
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={[
              "h-12 px-8 text-sm font-semibold uppercase tracking-[0.1em] transition-colors duration-150 active:translate-y-px",
              saved
                ? "border border-accent-bright text-accent-bright"
                : "bg-accent text-accent-foreground hover:bg-[#93293a]",
            ].join(" ")}
          >
            {saved ? "Enregistré !" : "Enregistrer la cascade"}
          </button>
        </div>
        {error && <p className="animate-fade-in mt-3 text-sm text-accent-bright">{error}</p>}
      </section>
    </AdminShell>
  );
}
