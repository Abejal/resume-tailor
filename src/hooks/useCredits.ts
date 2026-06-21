// Single source of truth for the visible credit balance.
//
// Signed-in: pulled from public.my_credits view (real DB balance).
// Anonymous: tracked client-side in localStorage and reconciled lazily — the
// edge function is the real authority. We optimistically decrement here and
// snap back to the server value if the response disagrees.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const ANON_KEY = "jobtailor_anon_credits";
const ANON_DEFAULT = 3;

function readAnon(): number {
  const raw = localStorage.getItem(ANON_KEY);
  if (raw == null) {
    localStorage.setItem(ANON_KEY, String(ANON_DEFAULT));
    return ANON_DEFAULT;
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

function writeAnon(n: number) {
  localStorage.setItem(ANON_KEY, String(Math.max(0, n)));
}

export function useCredits() {
  const { user, loading: authLoading } = useAuth();
  const [credits, setCredits] = useState<number>(readAnon());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setCredits(readAnon());
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("my_credits")
      .select("balance")
      .maybeSingle();
    setLoading(false);
    if (!error && data) setCredits(data.balance);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  // Realtime subscription for signed-in users.
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`credits:${user.id}`).on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "credits", filter: `user_id=eq.${user.id}` },
      (payload) => {
        const next = (payload.new as { balance?: number })?.balance;
        if (typeof next === "number") setCredits(next);
      },
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const decrementOptimistic = useCallback(() => {
    if (user) return; // server will update via realtime
    const next = Math.max(0, readAnon() - 1);
    writeAnon(next);
    setCredits(next);
  }, [user]);

  const setAnon = useCallback((n: number) => {
    if (user) return;
    writeAnon(n);
    setCredits(n);
  }, [user]);

  return { credits, loading, refresh, decrementOptimistic, setAnon };
}

export function clearAnonCredits() {
  localStorage.removeItem(ANON_KEY);
}
