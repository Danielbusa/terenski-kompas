"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Compass, LoaderCircle } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { flushQueue } from "@/lib/offline-queue";

export function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => !isSupabaseConfigured);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) window.location.replace("/login?next=/");
      else {
        setReady(true);
        void flushQueue();
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) window.location.replace("/login?next=/");
    });
    const sync = () => void flushQueue();
    window.addEventListener("online", sync);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("online", sync);
    };
  }, []);

  if (!isSupabaseConfigured) {
    return <main className="setup-screen"><div className="setup-card"><span className="brand-mark"><Compass /></span><p className="eyebrow">POTREBNO POVEZIVANJE</p><h1>Dashboard čeka Supabase podatke</h1><p>Dodaj stvarni URL projekta i anon ključ u <code>.env.local</code>. Javni delovi aplikacije su već dostupni.</p><div><a href="/join">Prijava volontera</a><a href="/donate">Donacije</a></div></div></main>;
  }
  if (!ready) return <main className="setup-screen"><LoaderCircle className="spin" /><p>Proveravamo pristup…</p></main>;
  return children;
}
