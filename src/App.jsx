import React, { useState, useEffect, useMemo } from "react";
import { X, ArrowRight, ChevronDown } from "lucide-react";
import {
  SERVER_CODES,
  MAX_VISITS,
  IMG_STAMP,
  IMG_LOGO,
  loadDB,
  saveDB,
  seedDemoDB,
  monthVisits,
  activeRewards,
  getTitle,
  generateUniqueCode,
  generateRecordId,
  formatDateFR,
} from "./store.js";

// Rotation par tampon pour un rendu tamponné à la main
const STAMP_ROTATIONS = [-7, 5, -4, 8, -6, 3, 7, -5, 4, -8];

const GRID_COLS = 5;
const GRID_ROWS = MAX_VISITS / GRID_COLS;
// Demi-largeur de cellule : 5 colonnes, 4 gouttières de 0.5rem
const CELL_INSET = "calc((100% - 2rem) / 10)";

const NOISE_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default function App() {
  const [db, setDb] = useState(loadDB);

  // Écran d'accueil
  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState("");

  // Création de carte
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupName, setSignupName] = useState("");
  const [signupNickname, setSignupNickname] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupInsta, setSignupInsta] = useState("");
  const [signupPromo, setSignupPromo] = useState(true);
  const [signupError, setSignupError] = useState("");
  const [createdUser, setCreatedUser] = useState(null);
  const [codeRevealed, setCodeRevealed] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Édition du profil
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileNickname, setProfileNickname] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileInsta, setProfileInsta] = useState("");
  const [profilePromo, setProfilePromo] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  // Validation de visite
  const [visitOpen, setVisitOpen] = useState(false);
  const [visitStep, setVisitStep] = useState("proof"); // proof | server | pin
  const [proofType, setProofType] = useState(null); // 'instagram' | 'google'
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinShake, setPinShake] = useState(false);

  // Après fermeture du volet : tampon animé + bandeau récompense
  const [justStamped, setJustStamped] = useState(null);
  const [rewardBanner, setRewardBanner] = useState(null);

  // Grille des 50 tampons, repliée par défaut
  const [gridOpen, setGridOpen] = useState(false);

  useEffect(() => {
    saveDB(db);
  }, [db]);

  useEffect(() => {
    if (visitOpen && visitStep === "pin" && pin.length === 4) {
      validatePin(pin);
    }
  }, [pin, visitStep, visitOpen]);

  const currentUser = db.users.find((u) => u.id === db.currentUserId) || null;
  const rewards = useMemo(() => activeRewards(db.rewards), [db.rewards]);
  const visits = currentUser ? monthVisits(currentUser) : 0;

  function handleLogin(e) {
    e.preventDefault();
    const raw = loginCode.trim().toUpperCase().replace(/\s+/g, "");
    if (!raw) {
      setLoginError("Entrez votre code pour continuer.");
      return;
    }
    const normalized = /^\d{4}$/.test(raw) ? `CF-${raw}` : raw;
    const user = db.users.find((u) => u.id === normalized);
    if (!user) {
      setLoginError("Ce code ne nous dit rien… Vérifiez-le, ou créez votre carte juste en dessous.");
      return;
    }
    setLoginError("");
    setLoginCode("");
    setDb((prev) => ({ ...prev, currentUserId: user.id }));
  }

  // TEMP : connexion de démonstration sans code
  function handleDemoLogin() {
    setDb((prev) => {
      const base = prev.users.length > 0 ? prev : seedDemoDB();
      return { ...base, currentUserId: base.users[0].id };
    });
  }

  function handleCreateCard(e) {
    e.preventDefault();
    const name = signupName.trim();
    const nickname = signupNickname.trim();
    const phoneDigits = signupPhone.replace(/\D/g, "");
    if (name.length < 2) {
      setSignupError("On aimerait connaître votre nom !");
      return;
    }
    if (nickname.length < 2) {
      setSignupError("Choisissez un surnom — c'est lui qu'on affichera fièrement.");
      return;
    }
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      setSignupError("Ce numéro de téléphone semble incomplet.");
      return;
    }
    const newUser = {
      id: generateUniqueCode(db.users),
      name,
      nickname,
      phone: signupPhone.trim(),
      instagram: signupInsta.trim().replace(/^@/, ""),
      promoOptIn: signupPromo,
      history: [],
    };
    // Création = connexion immédiate ; la révélation du code s'affiche par-dessus le parcours
    setDb((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
      currentUserId: newUser.id,
    }));
    setCreatedUser(newUser);
    setSignupError("");
  }

  function handleCopyCode() {
    const code = createdUser ? createdUser.id : "";
    if (!code) return;
    const markCopied = () => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(markCopied, () => fallbackCopy(code, markCopied));
    } else {
      fallbackCopy(code, markCopied);
    }
  }

  function fallbackCopy(text, onDone) {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(el);
    }
    onDone();
  }

  function closeSignup() {
    setSignupOpen(false);
    setSignupName("");
    setSignupNickname("");
    setSignupPhone("");
    setSignupInsta("");
    setSignupPromo(true);
    setSignupError("");
    setCreatedUser(null);
    setCodeRevealed(false);
    setCodeCopied(false);
  }

  function openProfile() {
    if (!currentUser) return;
    setProfileName(currentUser.name);
    setProfileNickname(currentUser.nickname || "");
    setProfilePhone(currentUser.phone);
    setProfileInsta(currentUser.instagram || "");
    setProfilePromo(Boolean(currentUser.promoOptIn));
    setProfileError("");
    setProfileSaved(false);
    setProfileOpen(true);
  }

  function handleSaveProfile(e) {
    e.preventDefault();
    const name = profileName.trim();
    const nickname = profileNickname.trim();
    const phoneDigits = profilePhone.replace(/\D/g, "");
    if (name.length < 2) {
      setProfileError("On aimerait connaître votre nom !");
      return;
    }
    if (nickname.length < 2) {
      setProfileError("Le surnom est obligatoire — c'est lui qu'on affiche.");
      return;
    }
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      setProfileError("Ce numéro de téléphone semble incomplet.");
      return;
    }
    setDb((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === prev.currentUserId
          ? {
              ...u,
              name,
              nickname,
              phone: profilePhone.trim(),
              instagram: profileInsta.trim().replace(/^@/, ""),
              promoOptIn: profilePromo,
            }
          : u
      ),
    }));
    setProfileError("");
    setProfileSaved(true);
    setTimeout(() => setProfileOpen(false), 800);
  }

  function handleLogout() {
    setDb((prev) => ({ ...prev, currentUserId: null }));
    setLoginCode("");
    setLoginError("");
    setRewardBanner(null);
    setJustStamped(null);
    setGridOpen(false);
  }

  function openVisitDrawer() {
    if (!currentUser || visits >= MAX_VISITS) return;
    setVisitStep("proof");
    setProofType(null);
    setPin("");
    setPinError("");
    setPinShake(false);
    setJustStamped(null);
    setRewardBanner(null);
    setVisitOpen(true);
  }

  function closeVisitDrawer() {
    setVisitOpen(false);
    setVisitStep("proof");
    setProofType(null);
    setPin("");
    setPinError("");
    setPinShake(false);
  }

  function handleSelectProof(type) {
    setProofType(type);
    setVisitStep("server");
  }

  function handleKeypadPress(digit) {
    setPinError("");
    setPin((prev) => (prev.length >= 4 ? prev : prev + digit));
  }

  function handleKeypadDelete() {
    setPinError("");
    setPin((prev) => prev.slice(0, -1));
  }

  // Enregistre une visite puis déclenche tampon + bandeau APRÈS fermeture du volet
  function applyStamp(type, serverCode) {
    const user = db.users.find((u) => u.id === db.currentUserId);
    if (!user) return;
    const newCount = Math.min(monthVisits(user) + 1, MAX_VISITS);
    const record = {
      id: generateRecordId(),
      date: new Date().toISOString(),
      type,
      serverCode,
    };
    setDb((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === prev.currentUserId ? { ...u, history: [...u.history, record] } : u
      ),
    }));
    setTimeout(() => {
      setGridOpen(true);
      setJustStamped(newCount);
      const reward = rewards.find((r) => r.visit === newCount);
      if (reward) setRewardBanner(reward);
      setTimeout(() => {
        const cell = document.getElementById(`cell-${newCount}`);
        if (cell) cell.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    }, 350);
  }

  function validatePin(enteredPin) {
    if (SERVER_CODES.includes(enteredPin)) {
      closeVisitDrawer();
      applyStamp(proofType, enteredPin);
    } else {
      setPinError("Code invalide — réessayez");
      setPinShake(true);
      setTimeout(() => {
        setPinShake(false);
        setPin("");
      }, 500);
    }
  }

  // TEMP : simule un tampon validé sans passer par le serveur
  function handleDemoStamp() {
    if (!currentUser || visits >= MAX_VISITS) return;
    setJustStamped(null);
    setRewardBanner(null);
    applyStamp(Math.random() < 0.5 ? "instagram" : "google", "1111");
  }

  const journeyComplete = visits >= MAX_VISITS;
  const nextReward = rewards.find((r) => r.visit > visits);
  const rewardVisits = new Set(rewards.map((r) => r.visit));
  const titles = db.titles;

  function renderCell(visitNumber) {
    const completed = visitNumber <= visits;
    const isCurrent = visitNumber === visits + 1;
    const isReward = rewardVisits.has(visitNumber);
    return (
      <div key={visitNumber} id={`cell-${visitNumber}`} className="relative z-10">
        {isReward && (
          <>
            <div className="glow-ring absolute -inset-0.5" />
            <div className="glow-ring absolute -inset-0.5 opacity-70 blur-md" />
          </>
        )}
        <div
          className={[
            "relative flex aspect-square items-center justify-center border bg-card transition-colors duration-200",
            isCurrent ? "border-2 border-accent-bright" : "border-border",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 left-1 font-mono text-[9px] font-medium",
              completed
                ? "text-accent-bright"
                : isCurrent
                  ? "text-foreground"
                  : "text-muted-foreground",
            ].join(" ")}
          >
            {String(visitNumber).padStart(2, "0")}
          </span>
          {completed && (
            <img
              src={IMG_STAMP}
              alt={`Tampon visite ${visitNumber}`}
              className={[
                "h-full w-full object-contain p-0.5 [filter:invert(1)] mix-blend-screen opacity-90",
                visitNumber === justStamped ? "animate-stamp-in" : "",
              ].join(" ")}
              style={{
                "--rot": `${STAMP_ROTATIONS[(visitNumber - 1) % STAMP_ROTATIONS.length]}deg`,
                transform:
                  visitNumber === justStamped
                    ? undefined
                    : `rotate(${STAMP_ROTATIONS[(visitNumber - 1) % STAMP_ROTATIONS.length]}deg)`,
              }}
            />
          )}
        </div>
      </div>
    );
  }

  function renderRow(r) {
    const start = r * GRID_COLS;
    const reversed = r % 2 === 1;
    const cells = Array.from({ length: GRID_COLS }, (_, i) => start + i + 1);
    const displayCells = reversed ? [...cells].reverse() : cells;
    const frac =
      visits <= start ? 0 : visits > start + GRID_COLS ? 1 : (visits - start - 1) / (GRID_COLS - 1);
    const exitSide = reversed ? "left" : "right";
    const enterSide = reversed ? "right" : "left";
    const exitDone = visits >= start + GRID_COLS + 1;
    const enterDone = visits >= start + 1;
    const sideStyle = (side) =>
      side === "right"
        ? { right: `calc(${CELL_INSET} - 1px)` }
        : { left: `calc(${CELL_INSET} - 1px)` };
    return (
      <React.Fragment key={r}>
        {r > 0 && (
          <div className="relative h-6">
            <div className="absolute bottom-0 top-0 w-0.5 bg-border" style={sideStyle(enterSide)} />
            {enterDone && (
              <div
                className="absolute bottom-0 top-0 w-0.5 bg-accent-bright"
                style={sideStyle(enterSide)}
              />
            )}
          </div>
        )}
        <div className="relative">
          <div
            className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-border"
            style={{ left: CELL_INSET, right: CELL_INSET }}
          />
          <div
            className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-accent-bright transition-all duration-500"
            style={{
              [reversed ? "right" : "left"]: CELL_INSET,
              width: `calc((100% - 2 * ${CELL_INSET}) * ${frac})`,
            }}
          />
          {r > 0 && (
            <>
              <div
                className="absolute top-0 bottom-1/2 w-0.5 bg-border"
                style={sideStyle(enterSide)}
              />
              {enterDone && (
                <div
                  className="absolute top-0 bottom-1/2 w-0.5 bg-accent-bright"
                  style={sideStyle(enterSide)}
                />
              )}
            </>
          )}
          {r < GRID_ROWS - 1 && (
            <>
              <div
                className="absolute bottom-0 top-1/2 w-0.5 bg-border"
                style={sideStyle(exitSide)}
              />
              {exitDone && (
                <div
                  className="absolute bottom-0 top-1/2 w-0.5 bg-accent-bright"
                  style={sideStyle(exitSide)}
                />
              )}
            </>
          )}
          <div className="relative grid grid-cols-5 gap-2">{displayCells.map(renderCell)}</div>
        </div>
      </React.Fragment>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased [letter-spacing:-0.01em]">
      <style>{`
        @property --glow-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shakeX {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-6px); }
          40%, 60% { transform: translateX(6px); }
        }
        @keyframes revealPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @keyframes stampIn {
          0% { transform: scale(2.6) rotate(var(--rot)); opacity: 0; }
          55% { transform: scale(0.92) rotate(var(--rot)); opacity: 1; }
          75% { transform: scale(1.04) rotate(var(--rot)); }
          100% { transform: scale(1) rotate(var(--rot)); opacity: 1; }
        }
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
        @keyframes glareSweep {
          0% { transform: translateX(-160%) skewX(-20deg); }
          55%, 100% { transform: translateX(320%) skewX(-20deg); }
        }
        .glare::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 45%;
          background: linear-gradient(90deg, transparent, rgba(250, 250, 250, 0.10), transparent);
          animation: glareSweep 2.8s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes chevronNudge {
          0%, 70%, 100% { transform: translateY(0); }
          80% { transform: translateY(3px); }
          90% { transform: translateY(-1px); }
        }
        .chevron-nudge { animation: chevronNudge 2.8s ease-in-out infinite; }
        .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.25, 0, 0, 1) both; }
        .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.25, 0, 0, 1) both; }
        .animate-fade-in { animation: fadeIn 0.2s ease-out both; }
        .animate-shake-x { animation: shakeX 0.5s ease-in-out both; }
        .animate-reveal-pulse { animation: revealPulse 0.5s cubic-bezier(0.25, 0, 0, 1) both; }
        .animate-stamp-in { animation: stampIn 0.5s cubic-bezier(0.25, 0, 0, 1) both; }
      `}</style>

      {/* Grain de bruit subtil sur toute la page */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[100] opacity-[0.015]"
        style={{ backgroundImage: NOISE_URL }}
      />

      {currentUser === null ? (
        /* ============================== ACCUEIL ============================== */
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between px-6 py-12">
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-center font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Est. 2017
            </p>

            <img
              src={IMG_LOGO}
              alt="The First — Coffee & Resto"
              className="mx-auto mt-6 w-64 [filter:invert(1)] mix-blend-screen"
            />

            <h1 className="mt-10 text-5xl font-black uppercase leading-none tracking-[-0.04em]">
              Chaque café
              <span className="block text-accent-bright">compte.</span>
            </h1>
            <div className="mt-5 h-1 w-16 bg-accent" />

            <form onSubmit={handleLogin} className="mt-12">
              <label
                htmlFor="login-code"
                className="mb-3 block font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
              >
                Déjà membre ?
              </label>
              <div className="flex items-stretch gap-4">
                <input
                  id="login-code"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  maxLength={7}
                  placeholder="CF-0000"
                  value={loginCode}
                  onChange={(e) => {
                    setLoginCode(e.target.value.toUpperCase());
                    setLoginError("");
                  }}
                  className="h-14 min-w-0 flex-1 border border-border bg-input px-4 font-mono text-base font-semibold tracking-[0.15em] text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-accent-bright"
                />
                <button
                  type="submit"
                  className="group relative flex shrink-0 items-center gap-2 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-accent-bright transition-all duration-150 active:translate-y-px"
                >
                  Entrer
                  <ArrowRight size={16} strokeWidth={1.5} />
                  <span className="absolute bottom-1 left-0 h-0.5 w-full origin-left bg-accent-bright transition-transform duration-150 group-hover:scale-x-110" />
                </button>
              </div>
              {loginError && (
                <p className="animate-fade-in mt-3 text-sm text-accent-bright">{loginError}</p>
              )}
            </form>

            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                ou
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={() => setSignupOpen(true)}
              className="h-14 w-full border border-foreground text-sm font-semibold uppercase tracking-[0.1em] text-foreground transition-colors duration-150 hover:bg-foreground hover:text-background active:translate-y-px"
            >
              Créer ma carte de fidélité
            </button>

            <button
              type="button"
              onClick={handleDemoLogin}
              className="mt-4 h-11 w-full border border-dashed border-muted-foreground/50 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground active:translate-y-px"
            >
              Temp — Connexion démo
            </button>
          </div>

          <p className="mt-12 text-center text-xs leading-relaxed text-muted-foreground">
            Pas de mot de passe, pas de spam. Juste du bon café.
          </p>
        </div>
      ) : (
        /* ============================== PARCOURS ============================== */
        <div className="mx-auto w-full max-w-md pb-44">
          <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
            <div className="flex h-[72px] items-center justify-between gap-3 px-6">
              <button
                type="button"
                onClick={openProfile}
                className="group flex min-w-0 items-center gap-3 text-left transition-opacity duration-150 hover:opacity-80 active:translate-y-px"
                title="Modifier mes infos"
              >
                <img
                  src={IMG_STAMP}
                  alt=""
                  className="h-10 w-10 shrink-0 [filter:invert(1)] mix-blend-screen opacity-90"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold leading-tight">
                    {currentUser.nickname || currentUser.name}
                    <span className="ml-2 font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      Modifier
                    </span>
                  </p>
                  <p className="font-mono text-xs font-medium tracking-[0.15em] text-accent-bright">
                    {currentUser.id}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="group relative shrink-0 py-2 font-mono text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors duration-150 hover:text-foreground active:translate-y-px"
              >
                Sortir
                <span className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-foreground transition-transform duration-150 group-hover:scale-x-100" />
              </button>
            </div>
          </header>

          <main className="px-6">
            {/* Compteur éditorial + titre */}
            <section className="animate-fade-in-up mt-10">
              <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Votre parcours du mois
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-7xl font-black leading-none tracking-[-0.04em] tabular-nums">
                  {visits}
                </span>
                <span className="text-2xl font-bold text-muted-foreground">/ {MAX_VISITS}</span>
              </div>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Votre titre
                </span>
                <span className="text-lg font-black uppercase tracking-[-0.02em] text-accent-bright">
                  {getTitle(titles, visits)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {journeyComplete
                  ? "Parcours du mois terminé — montrez cet écran au comptoir !"
                  : nextReward
                    ? `Encore ${nextReward.visit - visits} visite${nextReward.visit - visits > 1 ? "s" : ""} avant : ${nextReward.label.toLowerCase()}.`
                    : "Continuez, ça sent bon."}
              </p>
              <p className="mt-2 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
                Le parcours repart à zéro le 1er de chaque mois
              </p>
            </section>

            {/* Bandeau récompense (après fermeture du volet) */}
            {rewardBanner && (
              <div className="animate-fade-in-up mt-6 border-2 border-accent p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-bright">
                      Récompense débloquée
                    </p>
                    <p className="mt-1.5 text-sm font-bold leading-snug">{rewardBanner.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {rewardBanner.detail} — montrez cet écran au comptoir.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRewardBanner(null)}
                    aria-label="Fermer"
                    className="shrink-0 p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    <X size={18} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            )}

            {/* Grille des 50 tampons, repliable */}
            <section className="mt-10">
              <button
                type="button"
                onClick={() => setGridOpen((o) => !o)}
                aria-expanded={gridOpen}
                className="glare sticky top-[72px] z-20 flex w-full items-center justify-between gap-4 overflow-hidden border border-border bg-background px-4 py-4 transition-colors duration-150 hover:border-accent-bright active:translate-y-px"
              >
                <span className="min-w-0 text-left">
                  <span className="block font-mono text-xs font-medium uppercase tracking-[0.2em] text-foreground">
                    La tournée des tampons — {visits}/{MAX_VISITS}
                  </span>
                  <span className="mt-0.5 block font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                    {gridOpen ? "Appuyez pour replier" : "Appuyez pour dérouler"}
                  </span>
                </span>
                <ChevronDown
                  size={18}
                  strokeWidth={1.5}
                  className={[
                    "shrink-0 text-accent-bright transition-transform duration-200",
                    gridOpen ? "rotate-180" : "chevron-nudge",
                  ].join(" ")}
                />
              </button>

              {gridOpen && (
                <div className="animate-fade-in mt-4">
                  {Array.from({ length: GRID_ROWS }, (_, r) => renderRow(r))}
                </div>
              )}
            </section>

            {/* Registre des récompenses */}
            <section className="mt-12">
              <h2 className="mb-2 font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Vos récompenses du mois
              </h2>
              <div>
                {rewards.map((r) => {
                  const unlocked = visits >= r.visit;
                  return (
                    <div key={r.id} className="flex items-center gap-5 border-t border-border py-5">
                      <span
                        className={[
                          "font-mono text-3xl font-bold tabular-nums",
                          unlocked ? "text-accent-bright" : "text-muted-foreground/50",
                        ].join(" ")}
                      >
                        {String(r.visit).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={[
                            "text-sm font-semibold leading-snug",
                            unlocked ? "text-foreground" : "text-muted-foreground",
                          ].join(" ")}
                        >
                          {r.label}
                          <span className="ml-2 font-normal text-muted-foreground">
                            · {r.detail}
                          </span>
                        </p>
                        <p
                          className={[
                            "mt-1 font-mono text-[10px] font-medium uppercase tracking-[0.15em]",
                            unlocked ? "text-accent-bright" : "text-muted-foreground/60",
                          ].join(" ")}
                        >
                          {unlocked
                            ? "Débloquée — à réclamer au comptoir"
                            : `À la visite n°${r.visit}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Derniers passages */}
            {currentUser.history.length > 0 && (
              <section className="mt-10">
                <h2 className="mb-2 font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Vos derniers passages
                </h2>
                <div>
                  {[...currentUser.history]
                    .reverse()
                    .slice(0, 5)
                    .map((h, idx) => (
                      <div
                        key={h.id}
                        className="flex items-baseline justify-between gap-4 border-t border-border py-4"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">
                            Visite n°{currentUser.history.length - idx}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {h.type === "instagram" ? "Story Instagram" : "Avis Google"}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {formatDateFR(h.date)}
                        </span>
                      </div>
                    ))}
                </div>
              </section>
            )}
          </main>

          {/* Action principale */}
          <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md bg-gradient-to-t from-background via-background/95 to-transparent px-6 pb-6 pt-10">
            {journeyComplete ? (
              <div className="flex h-14 items-center justify-center border-2 border-accent-bright px-5 text-center text-xs font-semibold uppercase tracking-[0.1em] text-accent-bright">
                Parcours du mois terminé — bravo !
              </div>
            ) : (
              <button
                type="button"
                onClick={openVisitDrawer}
                className="h-14 w-full bg-accent text-sm font-semibold uppercase tracking-[0.1em] text-accent-foreground transition-colors duration-150 hover:bg-[#93293a] active:translate-y-px"
              >
                Tamponner ma visite
              </button>
            )}
            {!journeyComplete && (
              <button
                type="button"
                onClick={handleDemoStamp}
                className="mt-2 h-9 w-full border border-dashed border-muted-foreground/50 font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground active:translate-y-px"
              >
                Temp — Simuler un tampon
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================== CRÉATION DE CARTE ============================== */}
      {(signupOpen || createdUser) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
          <div
            className="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={createdUser ? undefined : closeSignup}
          />
          <div className="animate-fade-in-up relative max-h-[90vh] w-full max-w-sm overflow-y-auto border border-border bg-card p-6">
            <div className="absolute left-6 top-0 h-1 w-16 bg-accent" />
            {!createdUser ? (
              <>
                <div className="mb-6 flex items-start justify-between pt-2">
                  <div>
                    <h2 className="text-2xl font-black uppercase leading-tight tracking-[-0.04em]">
                      Bienvenue
                      <span className="block text-accent-bright">au club.</span>
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Quelques infos et votre carte est prête.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeSignup}
                    aria-label="Fermer"
                    className="p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    <X size={18} strokeWidth={1.5} />
                  </button>
                </div>

                <form onSubmit={handleCreateCard} className="space-y-5">
                  <div>
                    <label
                      htmlFor="signup-name"
                      className="mb-2 block font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Votre nom
                    </label>
                    <input
                      id="signup-name"
                      type="text"
                      autoComplete="name"
                      placeholder="Marie Dupont"
                      value={signupName}
                      onChange={(e) => {
                        setSignupName(e.target.value);
                        setSignupError("");
                      }}
                      className="h-14 w-full border border-border bg-input px-4 text-base text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-accent-bright"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="signup-nickname"
                      className="mb-2 block font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Votre surnom
                    </label>
                    <input
                      id="signup-nickname"
                      type="text"
                      autoComplete="off"
                      placeholder="Riri"
                      value={signupNickname}
                      onChange={(e) => {
                        setSignupNickname(e.target.value);
                        setSignupError("");
                      }}
                      className="h-14 w-full border border-border bg-input px-4 text-base text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-accent-bright"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="signup-phone"
                      className="mb-2 block font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Votre téléphone
                    </label>
                    <input
                      id="signup-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+216 20 123 456"
                      value={signupPhone}
                      onChange={(e) => {
                        setSignupPhone(e.target.value);
                        setSignupError("");
                      }}
                      className="h-14 w-full border border-border bg-input px-4 text-base text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-accent-bright"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="signup-instagram"
                      className="mb-2 block font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Votre Instagram{" "}
                      <span className="normal-case tracking-normal text-muted-foreground/60">
                        (optionnel)
                      </span>
                    </label>
                    <input
                      id="signup-instagram"
                      type="text"
                      autoComplete="off"
                      placeholder="@votrepseudo"
                      value={signupInsta}
                      onChange={(e) => setSignupInsta(e.target.value)}
                      className="h-14 w-full border border-border bg-input px-4 text-base text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-accent-bright"
                    />
                  </div>
                  <label className="flex cursor-pointer items-start gap-3" htmlFor="signup-promo">
                    <input
                      id="signup-promo"
                      type="checkbox"
                      checked={signupPromo}
                      onChange={(e) => setSignupPromo(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer appearance-none border border-border bg-input transition-colors duration-150 checked:border-accent-bright checked:bg-accent"
                    />
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      Je veux recevoir les offres exclusives et les bons plans du First.
                    </span>
                  </label>
                  {signupError && (
                    <p className="animate-fade-in text-sm text-accent-bright">{signupError}</p>
                  )}
                  <button
                    type="submit"
                    className="h-14 w-full bg-accent text-sm font-semibold uppercase tracking-[0.1em] text-accent-foreground transition-colors duration-150 hover:bg-[#93293a] active:translate-y-px"
                  >
                    Créer ma carte
                  </button>
                </form>
              </>
            ) : (
              <div className="pt-2 text-center">
                <img
                  src={IMG_LOGO}
                  alt="The First — Coffee & Resto"
                  className="mx-auto w-40 [filter:invert(1)] mix-blend-screen"
                />
                <h2 className="mt-5 text-2xl font-black uppercase leading-tight tracking-[-0.04em]">
                  Bienvenue, {createdUser.nickname || createdUser.name.split(" ")[0]} !
                </h2>
                <p className="mx-auto mt-2 max-w-[280px] text-sm leading-relaxed text-muted-foreground">
                  Voici votre code personnel. Notez-le : il vous permet de retrouver vos tampons sur
                  n'importe quel téléphone.
                </p>

                <div
                  className={[
                    "mx-auto mt-6 w-fit select-none border-2 px-8 py-4 font-mono text-3xl font-bold tracking-[0.2em] transition-all duration-700",
                    codeRevealed
                      ? "animate-reveal-pulse border-accent-bright text-accent-bright blur-0"
                      : "border-border text-foreground blur-md",
                  ].join(" ")}
                >
                  {createdUser.id}
                </div>

                <div className="mt-6 space-y-3">
                  {!codeRevealed ? (
                    <button
                      type="button"
                      onClick={() => setCodeRevealed(true)}
                      className="h-14 w-full border border-foreground text-sm font-semibold uppercase tracking-[0.1em] text-foreground transition-colors duration-150 hover:bg-foreground hover:text-background active:translate-y-px"
                    >
                      Révéler mon code
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className={[
                          "h-14 w-full border text-sm font-semibold uppercase tracking-[0.1em] transition-colors duration-150 active:translate-y-px",
                          codeCopied
                            ? "border-accent-bright text-accent-bright"
                            : "border-border text-foreground hover:border-foreground",
                        ].join(" ")}
                      >
                        {codeCopied ? "Copié !" : "Copier le code"}
                      </button>
                      <button
                        type="button"
                        onClick={closeSignup}
                        className="flex h-14 w-full items-center justify-center gap-2 bg-accent text-sm font-semibold uppercase tracking-[0.1em] text-accent-foreground transition-colors duration-150 hover:bg-[#93293a] active:translate-y-px"
                      >
                        Voir mon parcours
                        <ArrowRight size={16} strokeWidth={1.5} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================== MES INFOS ============================== */}
      {profileOpen && currentUser && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
          <div
            className="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setProfileOpen(false)}
          />
          <div className="animate-fade-in-up relative max-h-[90vh] w-full max-w-sm overflow-y-auto border border-border bg-card p-6">
            <div className="absolute left-6 top-0 h-1 w-16 bg-accent" />
            <div className="mb-6 flex items-start justify-between pt-2">
              <div>
                <h2 className="text-2xl font-black uppercase leading-tight tracking-[-0.04em]">
                  Mes infos
                </h2>
                <p className="mt-2 font-mono text-xs font-medium tracking-[0.15em] text-accent-bright">
                  {currentUser.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                aria-label="Fermer"
                className="p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div>
                <label
                  htmlFor="profile-name"
                  className="mb-2 block font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
                >
                  Votre nom
                </label>
                <input
                  id="profile-name"
                  type="text"
                  value={profileName}
                  onChange={(e) => {
                    setProfileName(e.target.value);
                    setProfileError("");
                  }}
                  className="h-14 w-full border border-border bg-input px-4 text-base text-foreground outline-none transition-colors duration-150 focus:border-accent-bright"
                />
              </div>
              <div>
                <label
                  htmlFor="profile-nickname"
                  className="mb-2 block font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
                >
                  Votre surnom
                </label>
                <input
                  id="profile-nickname"
                  type="text"
                  value={profileNickname}
                  onChange={(e) => {
                    setProfileNickname(e.target.value);
                    setProfileError("");
                  }}
                  className="h-14 w-full border border-border bg-input px-4 text-base text-foreground outline-none transition-colors duration-150 focus:border-accent-bright"
                />
              </div>
              <div>
                <label
                  htmlFor="profile-phone"
                  className="mb-2 block font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
                >
                  Votre téléphone
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => {
                    setProfilePhone(e.target.value);
                    setProfileError("");
                  }}
                  className="h-14 w-full border border-border bg-input px-4 text-base text-foreground outline-none transition-colors duration-150 focus:border-accent-bright"
                />
              </div>
              <div>
                <label
                  htmlFor="profile-instagram"
                  className="mb-2 block font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
                >
                  Votre Instagram{" "}
                  <span className="normal-case tracking-normal text-muted-foreground/60">
                    (optionnel)
                  </span>
                </label>
                <input
                  id="profile-instagram"
                  type="text"
                  placeholder="@votrepseudo"
                  value={profileInsta}
                  onChange={(e) => setProfileInsta(e.target.value)}
                  className="h-14 w-full border border-border bg-input px-4 text-base text-foreground outline-none transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-accent-bright"
                />
              </div>
              <label className="flex cursor-pointer items-start gap-3" htmlFor="profile-promo">
                <input
                  id="profile-promo"
                  type="checkbox"
                  checked={profilePromo}
                  onChange={(e) => setProfilePromo(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer appearance-none border border-border bg-input transition-colors duration-150 checked:border-accent-bright checked:bg-accent"
                />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  Je veux recevoir les offres exclusives et les bons plans du First.
                </span>
              </label>
              {profileError && (
                <p className="animate-fade-in text-sm text-accent-bright">{profileError}</p>
              )}
              <button
                type="submit"
                className={[
                  "h-14 w-full text-sm font-semibold uppercase tracking-[0.1em] transition-colors duration-150 active:translate-y-px",
                  profileSaved
                    ? "border border-accent-bright text-accent-bright"
                    : "bg-accent text-accent-foreground hover:bg-[#93293a]",
                ].join(" ")}
              >
                {profileSaved ? "Enregistré !" : "Enregistrer"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================== VOLET DE VISITE ============================== */}
      {visitOpen && currentUser && (
        <div className="fixed inset-0 z-50">
          <div
            className="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeVisitDrawer}
          />
          <div className="animate-slide-up absolute inset-x-0 bottom-0 mx-auto w-full max-w-md border-t-2 border-accent bg-card px-6 pb-8 pt-6">
            {visitStep === "proof" && (
              <div className="animate-fade-in">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Étape 1 / 3
                    </p>
                    <h2 className="mt-1 text-2xl font-black uppercase tracking-[-0.04em]">
                      On tamponne ?
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={closeVisitDrawer}
                    aria-label="Fermer"
                    className="p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    <X size={18} strokeWidth={1.5} />
                  </button>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Dites-nous comment vous avez partagé votre visite aujourd'hui.
                </p>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => handleSelectProof("instagram")}
                    className="group flex w-full items-center justify-between gap-4 border-t border-border py-5 text-left transition-colors duration-150 hover:bg-muted active:translate-y-px"
                  >
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.05em]">
                        Story Instagram
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Vous avez tagué @TheFirstCoffee dans une story
                      </p>
                    </div>
                    <ArrowRight
                      size={16}
                      strokeWidth={1.5}
                      className="shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-accent-bright"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectProof("google")}
                    className="group flex w-full items-center justify-between gap-4 border-t border-b border-border py-5 text-left transition-colors duration-150 hover:bg-muted active:translate-y-px"
                  >
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.05em]">Avis Google</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Vous avez laissé un avis avec une photo du lieu
                      </p>
                    </div>
                    <ArrowRight
                      size={16}
                      strokeWidth={1.5}
                      className="shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-accent-bright"
                    />
                  </button>
                </div>
              </div>
            )}

            {visitStep === "server" && (
              <div className="animate-fade-in">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Étape 2 / 3
                </p>
                <h2 className="mt-1 text-2xl font-black uppercase tracking-[-0.04em]">
                  Au tour du serveur.
                </h2>
                <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-muted-foreground">
                  Confiez votre téléphone à un membre de l'équipe : il valide votre visite avec son
                  code personnel.
                </p>
                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => setVisitStep("pin")}
                    className="h-14 w-full bg-accent text-sm font-semibold uppercase tracking-[0.1em] text-accent-foreground transition-colors duration-150 hover:bg-[#93293a] active:translate-y-px"
                  >
                    Saisir le code serveur
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisitStep("proof")}
                    className="group relative mx-auto block py-2 font-mono text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors duration-150 hover:text-foreground active:translate-y-px"
                  >
                    Retour
                    <span className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-foreground transition-transform duration-150 group-hover:scale-x-100" />
                  </button>
                </div>
              </div>
            )}

            {visitStep === "pin" && (
              <div className="animate-fade-in">
                <p className="text-center font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Étape 3 / 3
                </p>
                <h2 className="mt-1 text-center text-2xl font-black uppercase tracking-[-0.04em]">
                  Code serveur
                </h2>
                <p className="mt-1 text-center text-sm text-muted-foreground">
                  4 chiffres, réservé à l'équipe.
                </p>

                <div
                  className={[
                    "mx-auto mt-6 flex w-fit gap-3",
                    pinShake ? "animate-shake-x" : "",
                  ].join(" ")}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={[
                        "flex h-14 w-12 items-center justify-center border-2 font-mono text-2xl font-bold transition-colors duration-150",
                        pinError
                          ? "border-accent-bright text-accent-bright"
                          : pin.length === i
                            ? "border-accent-bright bg-input text-foreground"
                            : "border-border bg-input text-foreground",
                      ].join(" ")}
                    >
                      {pin[i] ? "•" : ""}
                    </div>
                  ))}
                </div>
                <p
                  className={[
                    "mt-3 h-5 text-center text-sm font-semibold text-accent-bright",
                    pinError ? "animate-fade-in" : "invisible",
                  ].join(" ")}
                >
                  {pinError || "—"}
                </p>

                <div className="mx-auto mt-2 grid max-w-[280px] grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleKeypadPress(d)}
                      className="border border-border bg-input py-4 font-mono text-xl font-semibold text-foreground transition-colors duration-100 hover:border-foreground active:translate-y-px"
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={closeVisitDrawer}
                    className="py-4 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors duration-100 hover:text-foreground active:translate-y-px"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress("0")}
                    className="border border-border bg-input py-4 font-mono text-xl font-semibold text-foreground transition-colors duration-100 hover:border-foreground active:translate-y-px"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleKeypadDelete}
                    aria-label="Effacer un chiffre"
                    className="border border-border bg-input py-4 font-mono text-xl text-foreground transition-colors duration-100 hover:border-foreground active:translate-y-px"
                  >
                    ⌫
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
