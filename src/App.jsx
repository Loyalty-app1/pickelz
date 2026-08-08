import React, { useState, useEffect, useMemo } from "react";
import { X, ArrowRight, ChevronDown } from "lucide-react";
import { useLiveDB } from "./useLiveDB.js";
import {
  SERVER_CODES,
  IMG_STAMP,
  IMG_LOGO,
  TAGLINE,
  INSTA_HANDLE,
  monthVisits,
  activeRewards,
  getTitle,
  formatDateFR,
  fetchDB,
  createCustomer,
  addVisit,
  updateCustomer,
  seedDemo,
} from "./store.js";

const SESSION_KEY = "tfc_current"; // code de l'utilisateur connecté (session locale)

// Rotation par tampon pour un rendu tamponné à la main
const STAMP_ROTATIONS = [-7, 5, -4, 8, -6, 3, 7, -5, 4, -8];

const GRID_COLS = 5;
// Demi-largeur de cellule : 5 colonnes, 4 gouttières de 0.5rem
const CELL_INSET = "calc((100% - 2rem) / 10)";

// Confettis de la petite célébration (récompense débloquée)
const CONFETTI_COLORS = ["#FFE0C4", "#FFFFFF", "#C87A2F", "#D1AC9F"];

function Splash({ text, sub }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center font-sans text-foreground">
      <img src={IMG_LOGO} alt="Pickel'z" className="w-52 animate-pulse" />
      <p className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">{text}</p>
      {sub && <p className="max-w-xs text-xs text-muted-foreground/70">{sub}</p>}
    </div>
  );
}

export default function App() {
  const { db, setDb, refresh } = useLiveDB();
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem(SESSION_KEY));

  function selectUser(code) {
    if (code) localStorage.setItem(SESSION_KEY, code);
    else localStorage.removeItem(SESSION_KEY);
    setCurrentUserId(code);
  }

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
  const [signupBusy, setSignupBusy] = useState(false);
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
    if (visitOpen && visitStep === "pin" && pin.length === 4) {
      validatePin(pin);
    }
  }, [pin, visitStep, visitOpen]);

  const currentUser = db.users.find((u) => u.id === currentUserId) || null;
  const cardSize = db.cardSize;
  const gridRows = Math.ceil(cardSize / GRID_COLS);
  // Seules les récompenses atteignables sur la carte actuelle
  const rewards = useMemo(
    () => activeRewards(db.rewards).filter((r) => r.visit <= cardSize),
    [db.rewards, cardSize]
  );
  const visits = currentUser ? monthVisits(currentUser, cardSize) : 0;

  const confettiPieces = useMemo(() => {
    if (!rewardBanner) return [];
    return Array.from({ length: 44 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2.2 + Math.random() * 1.8,
      size: 6 + Math.random() * 8,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: Math.random() * 360,
      round: i % 3 === 0,
    }));
  }, [rewardBanner]);

  function handleLogin(e) {
    e.preventDefault();
    const raw = loginCode.trim().toUpperCase().replace(/\s+/g, "");
    if (!raw) {
      setLoginError("Entrez votre code pour continuer.");
      return;
    }
    const user = db.users.find((u) => u.id === raw);
    if (!user) {
      setLoginError("Ce code ne nous dit rien… Vérifiez-le, ou créez votre carte juste en dessous.");
      return;
    }
    setLoginError("");
    setLoginCode("");
    selectUser(user.id);
  }

  // TEMP : connexion de démonstration sans code
  async function handleDemoLogin() {
    try {
      let users = db.users;
      if (users.length === 0) {
        await seedDemo();
        const fresh = await fetchDB();
        users = fresh.users;
        refresh();
      }
      if (users.length) selectUser(users[0].id);
    } catch (err) {
      setLoginError("Impossible de joindre la base. Réessayez.");
    }
  }

  async function handleCreateCard(e) {
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
    setSignupError("");
    setSignupBusy(true);
    try {
      const existingCodes = new Set(db.users.map((u) => u.id));
      const newUser = await createCustomer(
        {
          name,
          nickname,
          phone: signupPhone.trim(),
          instagram: signupInsta.trim().replace(/^@/, ""),
          promoOptIn: signupPromo,
        },
        existingCodes
      );
      // Création = connexion immédiate ; ajout optimiste + révélation du code
      setDb((prev) => ({ ...prev, users: [...prev.users, newUser] }));
      selectUser(newUser.id);
      setCreatedUser(newUser);
      refresh();
    } catch (err) {
      setSignupError("La création a échoué. Vérifiez votre connexion et réessayez.");
    } finally {
      setSignupBusy(false);
    }
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

  async function handleSaveProfile(e) {
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
    if (!currentUser) return;
    const patch = {
      name,
      nickname,
      phone: profilePhone.trim(),
      instagram: profileInsta.trim().replace(/^@/, ""),
      promoOptIn: profilePromo,
    };
    // Mise à jour optimiste, puis écriture Supabase
    setDb((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === currentUserId ? { ...u, ...patch } : u)),
    }));
    setProfileError("");
    setProfileSaved(true);
    try {
      await updateCustomer(currentUser.dbId, patch);
      refresh();
    } catch (err) {
      setProfileError("Enregistrement échoué — réessayez.");
      setProfileSaved(false);
      return;
    }
    setTimeout(() => setProfileOpen(false), 800);
  }

  function handleLogout() {
    selectUser(null);
    setLoginCode("");
    setLoginError("");
    setRewardBanner(null);
    setJustStamped(null);
    setGridOpen(false);
  }

  function openVisitDrawer() {
    if (!currentUser || visits >= cardSize) return;
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

  // Enregistre une visite : ajout optimiste (choreographie du tampon) + écriture Supabase.
  function applyStamp(type, serverCode) {
    const user = db.users.find((u) => u.id === currentUserId);
    if (!user) return;
    const newCount = Math.min(monthVisits(user, cardSize) + 1, cardSize);
    const tempId = `temp-${Date.now()}`;
    const record = { id: tempId, date: new Date().toISOString(), type, serverCode };
    setDb((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUserId ? { ...u, history: [...u.history, record] } : u
      ),
    }));
    // Écriture réelle en arrière-plan ; le temps réel réconcilie ensuite.
    addVisit(user.dbId, type, serverCode)
      .then(() => refresh())
      .catch(() => {
        // Échec : on retire le tampon optimiste
        setDb((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.id === currentUserId
              ? { ...u, history: u.history.filter((h) => h.id !== tempId) }
              : u
          ),
        }));
      });
    setTimeout(() => {
      setGridOpen(true);
      setJustStamped(newCount);
      setTimeout(() => {
        const cell = document.getElementById(`cell-${newCount}`);
        if (cell) cell.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
      // On laisse le tampon "claquer" sur la carte avant de célébrer la récompense
      const reward = rewards.find((r) => r.visit === newCount);
      if (reward) setTimeout(() => setRewardBanner(reward), 620);
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
    if (!currentUser || visits >= cardSize) return;
    setJustStamped(null);
    setRewardBanner(null);
    applyStamp(Math.random() < 0.5 ? "instagram" : "google", "1111");
  }

  const journeyComplete = visits >= cardSize;
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
            <div className="glow-ring absolute -inset-1 rounded-2xl" />
            <div className="glow-ring absolute -inset-1 rounded-2xl opacity-70 blur-md" />
          </>
        )}
        <div
          className={[
            "relative flex aspect-square items-center justify-center rounded-2xl transition-colors duration-200",
            isCurrent
              ? "bg-surface-deep ring-2 ring-foreground"
              : "bg-surface-deep ring-1 ring-border/60",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-1 left-1.5 text-[9px] font-semibold",
              completed ? "text-accent-foreground/0" : "text-muted-foreground",
            ].join(" ")}
          >
            {String(visitNumber).padStart(2, "0")}
          </span>
          {completed && (
            <span
              role="img"
              aria-label={`Tampon visite ${visitNumber}`}
              className={[
                "stamp-cream h-[92%] w-[92%]",
                visitNumber === justStamped ? "animate-stamp-in" : "",
              ].join(" ")}
              style={{
                "--stamp-url": `url(${IMG_STAMP})`,
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
        ? { right: `calc(${CELL_INSET} - 2px)` }
        : { left: `calc(${CELL_INSET} - 2px)` };
    return (
      <React.Fragment key={r}>
        {r > 0 && (
          <div className="relative h-6">
            <div
              className="absolute bottom-0 top-0 w-1 rounded-full bg-surface-deep"
              style={sideStyle(enterSide)}
            />
            {enterDone && (
              <div
                className="absolute bottom-0 top-0 w-1 rounded-full bg-foreground"
                style={sideStyle(enterSide)}
              />
            )}
          </div>
        )}
        <div className="relative">
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-deep"
            style={{ left: CELL_INSET, right: CELL_INSET }}
          />
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-foreground transition-all duration-500"
            style={{
              [reversed ? "right" : "left"]: CELL_INSET,
              width: `calc((100% - 2 * ${CELL_INSET}) * ${frac})`,
            }}
          />
          {r > 0 && (
            <>
              <div
                className="absolute top-0 bottom-1/2 w-1 rounded-full bg-surface-deep"
                style={sideStyle(enterSide)}
              />
              {enterDone && (
                <div
                  className="absolute top-0 bottom-1/2 w-1 rounded-full bg-foreground"
                  style={sideStyle(enterSide)}
                />
              )}
            </>
          )}
          {r < gridRows - 1 && (
            <>
              <div
                className="absolute bottom-0 top-1/2 w-1 rounded-full bg-surface-deep"
                style={sideStyle(exitSide)}
              />
              {exitDone && (
                <div
                  className="absolute bottom-0 top-1/2 w-1 rounded-full bg-foreground"
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

  const inputClass =
    "h-14 w-full rounded-2xl border-2 border-transparent bg-surface px-4 text-base text-foreground outline-none transition-colors duration-200 placeholder:text-muted-foreground/60 focus:border-foreground";
  const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground";
  const btnPrimary =
    "h-14 w-full rounded-full bg-accent font-display text-lg font-extrabold tracking-wide text-accent-foreground transition-all duration-150 hover:brightness-105 active:scale-[0.97]";
  const btnGhost =
    "h-14 w-full rounded-full border-2 border-foreground/70 font-display text-lg font-extrabold tracking-wide text-foreground transition-all duration-150 hover:bg-foreground hover:text-accent-foreground active:scale-[0.97]";

  if (db.loading) return <Splash text="Chargement…" />;
  if (db.error)
    return <Splash text="Connexion à la base impossible" sub="Vérifiez votre réseau puis rechargez la page." />;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased">
      <style>{`
        @property --glow-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shakeX {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-6px); }
          40%, 60% { transform: translateX(6px); }
        }
        @keyframes revealPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
        @keyframes stampIn {
          0% { transform: scale(2.6) rotate(var(--rot)); opacity: 0; }
          55% { transform: scale(0.9) rotate(var(--rot)); opacity: 1; }
          75% { transform: scale(1.06) rotate(var(--rot)); }
          100% { transform: scale(1) rotate(var(--rot)); opacity: 1; }
        }
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
          background: linear-gradient(90deg, transparent, rgba(255, 224, 196, 0.16), transparent);
          animation: glareSweep 2.8s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes chevronNudge {
          0%, 70%, 100% { transform: translateY(0); }
          80% { transform: translateY(3px); }
          90% { transform: translateY(-1px); }
        }
        .chevron-nudge { animation: chevronNudge 2.8s ease-in-out infinite; }
        .animate-fade-in-up { animation: fadeInUp 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        .animate-slide-up { animation: slideUp 0.32s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        .animate-fade-in { animation: fadeIn 0.2s ease-out both; }
        .animate-shake-x { animation: shakeX 0.5s ease-in-out both; }
        .animate-reveal-pulse { animation: revealPulse 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        .animate-stamp-in { animation: stampIn 0.5s cubic-bezier(0.2, 0.9, 0.25, 1) both; }
        @keyframes popIn {
          0% { transform: scale(0.6); opacity: 0; }
          70% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-12vh) rotate(0deg); opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
        }
        .animate-pop-in { animation: popIn 0.5s cubic-bezier(0.2, 0.9, 0.25, 1) both; }
      `}</style>

      {currentUser === null ? (
        /* ============================== ACCUEIL ============================== */
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-between px-6 py-12">
          <div className="flex flex-1 flex-col justify-center">
            <img
              src={IMG_LOGO}
              alt={`Pickel'z — ${TAGLINE}`}
              className="mx-auto w-64 max-w-full"
            />

            <h1 className="mt-8 text-center font-display text-3xl font-extrabold text-[#FFE0C4]">
              Love at the first bite <span aria-hidden="true">♥</span>
            </h1>

            <form onSubmit={handleLogin} className="mt-12">
              <label htmlFor="login-code" className={labelClass}>
                Déjà membre ?
              </label>
              <div className="flex items-stretch gap-3">
                <input
                  id="login-code"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  maxLength={10}
                  placeholder="AB-000000"
                  value={loginCode}
                  onChange={(e) => {
                    setLoginCode(e.target.value.toUpperCase());
                    setLoginError("");
                  }}
                  className={`${inputClass} flex-1 font-semibold tracking-[0.12em]`}
                />
                <button
                  type="submit"
                  className="flex h-14 shrink-0 items-center gap-2 rounded-full bg-accent px-6 font-display text-lg font-extrabold text-accent-foreground transition-all duration-150 hover:brightness-105 active:scale-[0.97]"
                >
                  Go
                  <ArrowRight size={18} strokeWidth={2.5} />
                </button>
              </div>
              {loginError && (
                <p className="animate-fade-in mt-3 text-sm font-medium">{loginError}</p>
              )}
            </form>

            <div className="my-7 flex items-center gap-4">
              <div className="h-0.5 flex-1 rounded-full bg-border/60" />
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                ou
              </span>
              <div className="h-0.5 flex-1 rounded-full bg-border/60" />
            </div>

            <button type="button" onClick={() => setSignupOpen(true)} className={btnGhost}>
              Créer ma carte
            </button>

            <button
              type="button"
              onClick={handleDemoLogin}
              className="mt-4 h-11 w-full rounded-full border-2 border-dashed border-muted-foreground/40 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground active:scale-[0.98]"
            >
              Temp — Connexion démo
            </button>
          </div>

          <p className="mt-12 text-center text-xs leading-relaxed text-muted-foreground">
            Pas de mot de passe, pas de spam. Juste de bons burgers.
          </p>
        </div>
      ) : (
        /* ============================== PARCOURS ============================== */
        <div className="mx-auto w-full max-w-md pb-44">
          <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl">
            <div className="flex h-[76px] items-center justify-between gap-3 px-6">
              <button
                type="button"
                onClick={openProfile}
                className="group flex min-w-0 items-center gap-3 text-left transition-transform duration-150 active:scale-[0.98]"
                title="Modifier mes infos"
              >
                <span
                  aria-hidden="true"
                  className="stamp-cream h-11 w-11 shrink-0"
                  style={{ "--stamp-url": `url(${IMG_STAMP})` }}
                />
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold leading-tight">
                    {currentUser.nickname || currentUser.name}
                  </p>
                  <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">
                    {currentUser.id}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors duration-150 hover:text-foreground active:scale-95"
              >
                Sortir
              </button>
            </div>
          </header>

          <main className="px-6">
            {/* Compteur + titre */}
            <section className="animate-fade-in-up mt-4 rounded-[2rem] bg-surface p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Votre parcours du mois
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-7xl font-extrabold tabular-nums">{visits}</span>
                <span className="font-display text-2xl font-bold text-muted-foreground">
                  / {cardSize}
                </span>
              </div>
              <div className="mt-3 inline-flex rounded-full bg-accent px-4 py-1.5">
                <span className="font-display text-base font-extrabold text-accent-foreground">
                  {getTitle(titles, visits)}
                </span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {journeyComplete
                  ? "Parcours du mois terminé — montrez cet écran au comptoir !"
                  : nextReward
                    ? `Encore ${nextReward.visit - visits} visite${nextReward.visit - visits > 1 ? "s" : ""} avant : ${nextReward.label.toLowerCase()}.`
                    : "Continuez, ça sent bon."}
              </p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                Le parcours repart à zéro le 1er de chaque mois
              </p>
            </section>

            {/* Grille des tampons, repliable */}
            <section className="mt-4">
              <button
                type="button"
                onClick={() => setGridOpen((o) => !o)}
                aria-expanded={gridOpen}
                className="glare sticky top-[76px] z-20 flex w-full items-center justify-between gap-4 overflow-hidden rounded-[1.75rem] bg-surface px-5 py-4 transition-colors duration-150 hover:bg-raised active:scale-[0.99]"
              >
                <span className="min-w-0 text-left">
                  <span className="block font-display text-lg font-bold leading-tight">
                    La carte des tampons
                  </span>
                  <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {gridOpen ? "Appuyez pour replier" : "Appuyez pour dérouler"} · {visits}/
                    {cardSize}
                  </span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <ChevronDown
                    size={20}
                    strokeWidth={2.75}
                    className={[
                      "transition-transform duration-200",
                      gridOpen ? "rotate-180" : "chevron-nudge",
                    ].join(" ")}
                  />
                </span>
              </button>

              {gridOpen && (
                <div className="animate-fade-in mt-4 rounded-[2rem] bg-surface p-4">
                  {Array.from({ length: gridRows }, (_, r) => renderRow(r))}
                </div>
              )}
            </section>

            {/* Registre des récompenses */}
            <section className="mt-8">
              <h2 className="mb-3 font-display text-2xl font-extrabold">Vos récompenses</h2>
              <div className="space-y-2">
                {rewards.map((r) => {
                  const unlocked = visits >= r.visit;
                  return (
                    <div
                      key={r.id}
                      className={[
                        "flex items-center gap-4 rounded-3xl p-4 transition-colors duration-200",
                        unlocked ? "bg-accent text-accent-foreground" : "bg-surface",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-display text-xl font-extrabold tabular-nums",
                          unlocked
                            ? "bg-accent-foreground/10 text-accent-foreground"
                            : "bg-surface-deep text-muted-foreground",
                        ].join(" ")}
                      >
                        {r.visit}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={[
                            "font-display text-lg font-bold leading-tight",
                            unlocked ? "" : "text-muted-foreground",
                          ].join(" ")}
                        >
                          {r.label}
                        </p>
                        <p
                          className={[
                            "mt-0.5 text-xs font-medium",
                            unlocked ? "opacity-75" : "text-muted-foreground/70",
                          ].join(" ")}
                        >
                          {unlocked ? `${r.detail} — à réclamer au comptoir` : r.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Derniers passages */}
            {currentUser.history.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 font-display text-2xl font-extrabold">Vos derniers passages</h2>
                <div className="overflow-hidden rounded-[2rem] bg-surface">
                  {[...currentUser.history]
                    .reverse()
                    .slice(0, 5)
                    .map((h, idx) => (
                      <div
                        key={h.id}
                        className="flex items-baseline justify-between gap-4 px-5 py-4 [&+&]:border-t [&+&]:border-border/40"
                      >
                        <div className="min-w-0">
                          <p className="font-display text-base font-bold">
                            Visite n°{currentUser.history.length - idx}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {h.type === "instagram" ? "Story Instagram" : "Avis Google"}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
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
              <div className="flex h-14 items-center justify-center rounded-full border-2 border-foreground px-5 text-center font-display text-base font-extrabold">
                Parcours terminé — bravo !
              </div>
            ) : (
              <button type="button" onClick={openVisitDrawer} className={btnPrimary}>
                Tamponner ma visite
              </button>
            )}
            {!journeyComplete && (
              <button
                type="button"
                onClick={handleDemoStamp}
                className="mt-2 h-9 w-full rounded-full border-2 border-dashed border-muted-foreground/40 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground active:scale-[0.98]"
              >
                Temp — Simuler un tampon
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================== CRÉATION DE CARTE ============================== */}
      {(signupOpen || createdUser) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-5">
          <div
            className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={createdUser ? undefined : closeSignup}
          />
          <div className="animate-fade-in-up relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-[2rem] bg-background p-6 ring-2 ring-border">
            {!createdUser ? (
              <>
                <div className="mb-6 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-3xl font-extrabold leading-tight">
                      Bienvenue au club.
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      Quelques infos et votre carte est prête.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeSignup}
                    aria-label="Fermer"
                    className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors duration-150 hover:bg-surface hover:text-foreground"
                  >
                    <X size={18} strokeWidth={2.5} />
                  </button>
                </div>

                <form onSubmit={handleCreateCard} className="space-y-4">
                  <div>
                    <label htmlFor="signup-name" className={labelClass}>
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
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-nickname" className={labelClass}>
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
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-phone" className={labelClass}>
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
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-instagram" className={labelClass}>
                      Votre Instagram{" "}
                      <span className="normal-case tracking-normal opacity-70">(optionnel)</span>
                    </label>
                    <input
                      id="signup-instagram"
                      type="text"
                      autoComplete="off"
                      placeholder="@votrepseudo"
                      value={signupInsta}
                      onChange={(e) => setSignupInsta(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <label
                    className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface p-4"
                    htmlFor="signup-promo"
                  >
                    <input
                      id="signup-promo"
                      type="checkbox"
                      checked={signupPromo}
                      onChange={(e) => setSignupPromo(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-md bg-surface-deep ring-2 ring-border transition-colors duration-150 checked:bg-accent checked:ring-accent"
                    />
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      Je veux recevoir les offres exclusives et les bons plans Pickel'z.
                    </span>
                  </label>
                  {signupError && (
                    <p className="animate-fade-in text-sm font-medium">{signupError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={signupBusy}
                    className={`${btnPrimary} disabled:opacity-60`}
                  >
                    {signupBusy ? "Création…" : "Créer ma carte"}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center">
                <img src={IMG_LOGO} alt="Pickel'z" className="mx-auto w-40" />
                <h2 className="mt-6 font-display text-3xl font-extrabold leading-tight">
                  Bienvenue, {createdUser.nickname || createdUser.name.split(" ")[0]} !
                </h2>
                <p className="mx-auto mt-2 max-w-[290px] text-sm leading-relaxed text-muted-foreground">
                  Voici votre code personnel : c'est votre clé pour retrouver vos tampons sur
                  n'importe quel téléphone.
                </p>

                <div
                  className={[
                    "mx-auto mt-6 w-fit select-none rounded-2xl px-8 py-4 font-display text-4xl font-extrabold tracking-[0.1em] transition-all duration-700",
                    codeRevealed
                      ? "animate-reveal-pulse bg-accent text-accent-foreground blur-0"
                      : "bg-surface text-foreground blur-md",
                  ].join(" ")}
                >
                  {createdUser.id}
                </div>

                <p className="mx-auto mt-4 max-w-[290px] text-xs font-semibold leading-relaxed text-foreground">
                  ⚠️ Gardez-le confidentiel et notez-le bien — il ne sera plus jamais réaffiché.
                </p>

                <div className="mt-6 space-y-3">
                  {!codeRevealed ? (
                    <button
                      type="button"
                      onClick={() => setCodeRevealed(true)}
                      className={btnPrimary}
                    >
                      Révéler mon code
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className={
                          codeCopied
                            ? "h-14 w-full rounded-full bg-surface font-display text-lg font-extrabold text-foreground"
                            : btnGhost
                        }
                      >
                        {codeCopied ? "Copié !" : "Copier le code"}
                      </button>
                      <button type="button" onClick={closeSignup} className={btnPrimary}>
                        Voir mon parcours
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
        <div className="fixed inset-0 z-40 flex items-center justify-center p-5">
          <div
            className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setProfileOpen(false)}
          />
          <div className="animate-fade-in-up relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-[2rem] bg-background p-6 ring-2 ring-border">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl font-extrabold leading-tight">Mes infos</h2>
                <p className="mt-1 text-sm font-semibold tracking-[0.12em] text-muted-foreground">
                  {currentUser.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                aria-label="Fermer"
                className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors duration-150 hover:bg-surface hover:text-foreground"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label htmlFor="profile-name" className={labelClass}>
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
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="profile-nickname" className={labelClass}>
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
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="profile-phone" className={labelClass}>
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
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="profile-instagram" className={labelClass}>
                  Votre Instagram{" "}
                  <span className="normal-case tracking-normal opacity-70">(optionnel)</span>
                </label>
                <input
                  id="profile-instagram"
                  type="text"
                  placeholder="@votrepseudo"
                  value={profileInsta}
                  onChange={(e) => setProfileInsta(e.target.value)}
                  className={inputClass}
                />
              </div>
              <label
                className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface p-4"
                htmlFor="profile-promo"
              >
                <input
                  id="profile-promo"
                  type="checkbox"
                  checked={profilePromo}
                  onChange={(e) => setProfilePromo(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-md bg-surface-deep ring-2 ring-border transition-colors duration-150 checked:bg-accent checked:ring-accent"
                />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  Je veux recevoir les offres exclusives et les bons plans Pickel'z.
                </span>
              </label>
              {profileError && <p className="animate-fade-in text-sm font-medium">{profileError}</p>}
              <button
                type="submit"
                className={
                  profileSaved
                    ? "h-14 w-full rounded-full bg-surface font-display text-lg font-extrabold text-foreground"
                    : btnPrimary
                }
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
            className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeVisitDrawer}
          />
          <div className="animate-slide-up absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-[2.5rem] bg-background px-6 pb-8 pt-4">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-border" />

            {visitStep === "proof" && (
              <div className="animate-fade-in">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      Étape 1 / 3
                    </p>
                    <h2 className="mt-1 font-display text-3xl font-extrabold">On tamponne ?</h2>
                  </div>
                  <button
                    type="button"
                    onClick={closeVisitDrawer}
                    aria-label="Fermer"
                    className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors duration-150 hover:bg-surface hover:text-foreground"
                  >
                    <X size={18} strokeWidth={2.5} />
                  </button>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Dites-nous comment vous avez partagé votre visite aujourd'hui.
                </p>
                <div className="mt-5 space-y-3">
                  <button
                    type="button"
                    onClick={() => handleSelectProof("instagram")}
                    className="flex w-full items-center justify-between gap-4 rounded-3xl bg-surface p-5 text-left transition-colors duration-150 hover:bg-raised active:scale-[0.98]"
                  >
                    <div>
                      <p className="font-display text-xl font-bold">Story Instagram</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Vous avez tagué {INSTA_HANDLE} dans une story
                      </p>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <ArrowRight size={18} strokeWidth={2.75} />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectProof("google")}
                    className="flex w-full items-center justify-between gap-4 rounded-3xl bg-surface p-5 text-left transition-colors duration-150 hover:bg-raised active:scale-[0.98]"
                  >
                    <div>
                      <p className="font-display text-xl font-bold">Avis Google</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Vous avez laissé un avis avec une photo du lieu
                      </p>
                    </div>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <ArrowRight size={18} strokeWidth={2.75} />
                    </span>
                  </button>
                </div>
              </div>
            )}

            {visitStep === "server" && (
              <div className="animate-fade-in">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Étape 2 / 3
                </p>
                <h2 className="mt-1 font-display text-3xl font-extrabold">Au tour de l'équipe.</h2>
                <p className="mt-2 max-w-[320px] text-sm leading-relaxed text-muted-foreground">
                  Confiez votre téléphone à un membre de l'équipe : il valide votre visite avec son
                  code personnel.
                </p>
                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => setVisitStep("pin")}
                    className={btnPrimary}
                  >
                    Saisir le code équipe
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisitStep("proof")}
                    className="mx-auto block rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-150 hover:text-foreground active:scale-95"
                  >
                    Retour
                  </button>
                </div>
              </div>
            )}

            {visitStep === "pin" && (
              <div className="animate-fade-in">
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Étape 3 / 3
                </p>
                <h2 className="mt-1 text-center font-display text-3xl font-extrabold">
                  Code équipe
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
                        "flex h-16 w-14 items-center justify-center rounded-2xl font-display text-3xl font-extrabold transition-colors duration-150",
                        pin[i]
                          ? "bg-accent text-accent-foreground"
                          : pin.length === i
                            ? "bg-surface ring-2 ring-foreground"
                            : "bg-surface",
                      ].join(" ")}
                    >
                      {pin[i] ? "•" : ""}
                    </div>
                  ))}
                </div>
                <p
                  className={[
                    "mt-3 h-5 text-center text-sm font-semibold",
                    pinError ? "animate-fade-in" : "invisible",
                  ].join(" ")}
                >
                  {pinError || "—"}
                </p>

                <div className="mx-auto mt-2 grid max-w-[300px] grid-cols-3 gap-2.5">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleKeypadPress(d)}
                      className="rounded-2xl bg-surface py-4 font-display text-2xl font-bold text-foreground transition-colors duration-100 hover:bg-raised active:scale-95"
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={closeVisitDrawer}
                    className="rounded-2xl py-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-100 hover:text-foreground active:scale-95"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress("0")}
                    className="rounded-2xl bg-surface py-4 font-display text-2xl font-bold text-foreground transition-colors duration-100 hover:bg-raised active:scale-95"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleKeypadDelete}
                    aria-label="Effacer un chiffre"
                    className="rounded-2xl bg-surface py-4 font-display text-2xl font-bold text-foreground transition-colors duration-100 hover:bg-raised active:scale-95"
                  >
                    ⌫
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================== CÉLÉBRATION RÉCOMPENSE ============================== */}
      {rewardBanner && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
          <div
            className="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setRewardBanner(null)}
          />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {confettiPieces.map((p) => (
              <span
                key={p.id}
                className="absolute top-0 block"
                style={{
                  left: `${p.left}%`,
                  width: p.size,
                  height: p.round ? p.size : p.size * 1.6,
                  backgroundColor: p.color,
                  borderRadius: p.round ? "50%" : "2px",
                  transform: `rotate(${p.rotate}deg)`,
                  animation: `confettiFall ${p.duration}s ${p.delay}s ease-in infinite`,
                }}
              />
            ))}
          </div>
          <div className="animate-pop-in relative w-full max-w-sm rounded-[2rem] bg-surface p-8 text-center ring-4 ring-accent">
            <button
              type="button"
              onClick={() => setRewardBanner(null)}
              aria-label="Fermer"
              className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors duration-150 hover:bg-raised hover:text-foreground"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
            <span
              aria-hidden="true"
              className="stamp-cream animate-stamp-in mx-auto block h-20 w-20"
              style={{ "--stamp-url": `url(${IMG_STAMP})`, "--rot": "0deg" }}
            />
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Récompense débloquée !
            </p>
            <p className="mt-2 font-display text-3xl font-extrabold leading-tight">
              {rewardBanner.label}
            </p>
            <div className="mt-3 inline-flex rounded-full bg-accent px-4 py-1.5">
              <span className="text-xs font-bold text-accent-foreground">{rewardBanner.detail}</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Montrez cet écran au comptoir pour en profiter.
            </p>
            <button
              type="button"
              onClick={() => setRewardBanner(null)}
              className="mt-6 h-14 w-full rounded-full bg-accent font-display text-lg font-extrabold text-accent-foreground transition-all duration-150 hover:brightness-105 active:scale-[0.97]"
            >
              Génial !
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
