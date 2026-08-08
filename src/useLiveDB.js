import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase.js";
import { fetchConfig, DEFAULT_TITLES, DEFAULT_CARD_SIZE } from "./store.js";

// Config non sensible (récompenses / titres / taille de carte) : lisible par anon
// et diffusée en temps réel. Les données clients ne transitent plus par ici —
// elles passent par les RPC (login/admin). D'où un hook "config only".
const CONFIG_TABLES = ["rewards", "titles", "settings"];

export function useConfig() {
  const [config, setConfig] = useState({
    rewards: [],
    titles: DEFAULT_TITLES,
    cardSize: DEFAULT_CARD_SIZE,
    loading: true,
    error: null,
  });
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const c = await fetchConfig();
      if (aliveRef.current) setConfig({ ...c, loading: false, error: null });
    } catch (e) {
      if (aliveRef.current)
        setConfig((prev) => ({ ...prev, loading: false, error: e.message || String(e) }));
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    refresh();

    let timer;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(() => aliveRef.current && refresh(), 180);
    };

    const channel = supabase.channel(`pickelz-config-${Math.random().toString(36).slice(2)}`);
    for (const table of CONFIG_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, debounced);
    }
    channel.subscribe();

    return () => {
      aliveRef.current = false;
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { config, refresh };
}
