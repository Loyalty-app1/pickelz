import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";
import { fetchDB, DEFAULT_TITLES, DEFAULT_CARD_SIZE } from "./store.js";

const TABLES = ["customers", "visits", "rewards", "titles", "settings"];

// Charge la base Supabase et la garde synchronisée en temps réel.
// Renvoie { db, refresh, setDb } ; db.loading est vrai jusqu'au 1er chargement.
export function useLiveDB() {
  const [db, setDb] = useState({
    users: [],
    rewards: [],
    titles: DEFAULT_TITLES,
    cardSize: DEFAULT_CARD_SIZE,
    loading: true,
    error: null,
  });
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const d = await fetchDB();
      if (aliveRef.current) setDb({ ...d, loading: false, error: null });
    } catch (e) {
      if (aliveRef.current) setDb((prev) => ({ ...prev, loading: false, error: e.message || String(e) }));
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    refresh();

    // Un changement sur n'importe quelle table → re-fetch (débruité).
    let timer;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (aliveRef.current) refresh();
      }, 180);
    };

    const channel = supabase.channel(`pickelz-live-${Math.random().toString(36).slice(2)}`);
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, debounced);
    }
    channel.subscribe();

    return () => {
      aliveRef.current = false;
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { db, setDb, refresh };
}
