import React, { useState, useRef, useMemo } from "react";
import { Wheel } from "react-custom-roulette";
import { X } from "lucide-react";
import { loadDB, isSameMonth, IMG_LOGO, BASE } from "./store.js";

const CONFETTI_COLORS = ["#7D2231", "#D96C7C", "#FAFAFA", "#737373"];

const NOISE_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function shortName(u) {
  if (u.nickname) return u.nickname;
  const parts = u.name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export default function RoulettePage() {
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);
  const [winner, setWinner] = useState(null);
  const [showWinner, setShowWinner] = useState(false);

  const audioRef = useRef(null);
  const tickTimerRef = useRef(null);

  const participants = useMemo(() => {
    const db = loadDB();
    return db.users.filter((u) => u.history.some((h) => isSameMonth(h.date)));
  }, []);

  const wheelData = participants.map((u, i) => ({
    option: shortName(u),
    style: {
      // Alternance vin/noir ; si le nombre est impair, la dernière part passe en gris
      backgroundColor:
        i === participants.length - 1 && participants.length % 2 === 1
          ? "#1A1A1A"
          : i % 2 === 0
            ? "#7D2231"
            : "#0F0F0F",
      textColor: "#FAFAFA",
    },
  }));

  const monthLabel = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const confettiPieces = useMemo(() => {
    if (!showWinner) return [];
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 2.5 + Math.random() * 2,
      size: 7 + Math.random() * 9,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: Math.random() * 360,
      round: i % 3 === 0,
    }));
  }, [showWinner]);

  function getAudio() {
    if (!audioRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioRef.current = Ctx ? new Ctx() : null;
    }
    if (audioRef.current && audioRef.current.state === "suspended") {
      audioRef.current.resume();
    }
    return audioRef.current;
  }

  function playTick() {
    const ctx = getAudio();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 1700;
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      /* le son n'est jamais bloquant */
    }
  }

  function playFanfare() {
    const ctx = getAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        const t = now + i * 0.13;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.7);
      });
      [523.25, 659.25, 783.99].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.value = freq;
        const t = now + 0.55;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.06, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 1.7);
      });
    } catch {
      /* le son n'est jamais bloquant */
    }
  }

  function startTicks() {
    stopTicks();
    tickTimerRef.current = setInterval(playTick, 90);
  }

  function stopTicks() {
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }
  }

  function handleSpin() {
    if (mustSpin || participants.length === 0) return;
    getAudio();
    const idx = Math.floor(Math.random() * participants.length);
    setPrizeNumber(idx);
    setWinner(null);
    setShowWinner(false);
    setMustSpin(true);
    startTicks();
  }

  function handleStop() {
    setMustSpin(false);
    stopTicks();
    setWinner(participants[prizeNumber]);
    setShowWinner(true);
    playFanfare();
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased [letter-spacing:-0.01em]">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn {
          0% { transform: scale(0.6); opacity: 0; }
          70% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-8vh) rotate(0deg); opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0; }
        }
        @keyframes winnerGlow {
          0%, 100% { text-shadow: 0 0 30px rgba(217, 108, 124, 0.4); }
          50% { text-shadow: 0 0 80px rgba(217, 108, 124, 0.9); }
        }
        .animate-fade-in { animation: fadeIn 0.3s ease-out both; }
        .animate-pop-in { animation: popIn 0.5s cubic-bezier(0.25, 0, 0, 1) both; }
        .animate-winner-glow { animation: winnerGlow 2s ease-in-out infinite; }
      `}</style>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[100] opacity-[0.015]"
        style={{ backgroundImage: NOISE_URL }}
      />

      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-8 py-10">
        <header className="flex w-full items-center justify-between">
          <img
            src={IMG_LOGO}
            alt="The First — Coffee & Resto"
            className="w-36 [filter:invert(1)] mix-blend-screen"
          />
          <a
            href={BASE}
            className="group relative py-2 font-mono text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            Retour à l'app
            <span className="absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-foreground transition-transform duration-150 group-hover:scale-x-100" />
          </a>
        </header>

        <div className="mt-8 text-center">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Tirage au sort — {monthLabel}
          </p>
          <h1 className="mt-3 text-6xl font-black uppercase leading-none tracking-[-0.04em]">
            La roue du
            <span className="ml-4 text-accent-bright">First.</span>
          </h1>
          <div className="mx-auto mt-5 h-1 w-16 bg-accent" />
          <p className="mt-4 text-base text-muted-foreground">
            {participants.length > 0
              ? `${participants.length} client${participants.length > 1 ? "s" : ""} dans la roue — tous ceux qui sont passés nous voir ce mois-ci.`
              : "Aucun participant ce mois-ci pour l'instant."}
          </p>
        </div>

        {participants.length > 0 ? (
          <div className="mt-10 flex flex-col items-center">
            <div className="[&>div]:!m-0">
              <Wheel
                mustStartSpinning={mustSpin}
                prizeNumber={prizeNumber}
                data={wheelData}
                onStopSpinning={handleStop}
                outerBorderColor="#262626"
                outerBorderWidth={8}
                innerBorderColor="#262626"
                innerBorderWidth={4}
                innerRadius={12}
                radiusLineColor="#0A0A0A"
                radiusLineWidth={2}
                textColors={["#FAFAFA"]}
                fontFamily="Inter Tight"
                fontSize={16}
                fontWeight={700}
                textDistance={62}
                spinDuration={1.1}
              />
            </div>
            <button
              type="button"
              onClick={handleSpin}
              disabled={mustSpin}
              className="mt-10 h-16 w-72 bg-accent text-base font-semibold uppercase tracking-[0.1em] text-accent-foreground transition-colors duration-150 hover:bg-[#93293a] active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
            >
              {mustSpin ? "La roue tourne…" : "Lancer la roue"}
            </button>
          </div>
        ) : (
          <div className="mt-16 border border-border px-12 py-16 text-center">
            <p className="text-lg font-bold uppercase tracking-[0.05em]">La roue attend ses joueurs</p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Dès qu'un client tamponne une visite ce mois-ci, son nom rejoint automatiquement le
              tirage.
            </p>
          </div>
        )}
      </div>

      {/* Annonce du gagnant */}
      {showWinner && winner && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="animate-fade-in absolute inset-0 bg-black/90 backdrop-blur-md" />
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
          <div className="animate-pop-in relative mx-8 w-full max-w-3xl border-2 border-accent bg-card px-10 py-14 text-center">
            <button
              type="button"
              onClick={() => setShowWinner(false)}
              aria-label="Fermer"
              className="absolute right-5 top-5 p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              <X size={22} strokeWidth={1.5} />
            </button>
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.25em] text-accent-bright">
              Et le gagnant du mois est…
            </p>
            <p className="animate-winner-glow mt-6 text-7xl font-black uppercase leading-none tracking-[-0.04em]">
              {winner.name}
            </p>
            {winner.nickname && (
              <p className="mt-4 text-2xl font-bold text-accent-bright">« {winner.nickname} »</p>
            )}
            <p className="mt-8 text-base text-muted-foreground">
              Bravo ! Passez au comptoir pour récupérer votre cadeau.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowWinner(false);
                  handleSpin();
                }}
                className="h-14 w-56 border border-foreground text-sm font-semibold uppercase tracking-[0.1em] text-foreground transition-colors duration-150 hover:bg-foreground hover:text-background active:translate-y-px"
              >
                Relancer la roue
              </button>
              <button
                type="button"
                onClick={() => setShowWinner(false)}
                className="h-14 w-56 bg-accent text-sm font-semibold uppercase tracking-[0.1em] text-accent-foreground transition-colors duration-150 hover:bg-[#93293a] active:translate-y-px"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
