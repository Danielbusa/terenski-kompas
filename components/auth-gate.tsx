"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass, LoaderCircle } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { flushQueue } from "@/lib/offline-queue";

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(() => !isSupabaseConfigured);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login?next=/");
      else {
        setReady(true);
        void flushQueue();
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login?next=/");
    });
    const sync = () => void flushQueue();
    window.addEventListener("online", sync);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("online", sync);
    };
  }, [router]);

  if (!isSupabaseConfigured) {
    return <main className="setup-screen"><div className="setup-card"><span className="brand-mark"><Compass /></span><p className="eyebrow">POTREBNO POVEZIVANJE</p><h1>Dashboard čeka Supabase podatke</h1><p>Dodaj stvarni URL projekta i anon ključ u <code>.env.local</code>. Javni delovi aplikacije su već dostupni.</p><div><Link href="/join">Prijava volontera</Link><Link href="/donate">Donacije</Link></div></div></main>;
  }
  if (!ready) return <main className="setup-screen"><LoaderCircle className="spin" /><p>Proveravamo pristup…</p></main>;
  return children;
}
