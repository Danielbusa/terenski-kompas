"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Compass, LoaderCircle } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { flushQueue } from "@/lib/offline-queue";

type AccessState = "checking" | "approved" | "pending" | "rejected" | "error";

export function AuthGate({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<AccessState>(() => isSupabaseConfigured ? "checking" : "error");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        window.location.replace("/login?next=/");
        return;
      }
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("approval_status")
        .eq("id", data.session.user.id)
        .single();
      if (error) {
        setMessage(error.message);
        setAccess("error");
        return;
      }
      const status = profile.approval_status as "pending" | "approved" | "rejected";
      setAccess(status);
      if (status === "approved") void flushQueue();
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

  const signOut = async () => {
    await getSupabase()?.auth.signOut();
    window.location.href = "/login";
  };

  if (!isSupabaseConfigured) {
    return <main className="setup-screen"><div className="setup-card"><span className="brand-mark"><Compass /></span><p className="eyebrow">POTREBNO POVEZIVANJE</p><h1>Dashboard čeka Supabase podatke</h1><p>Dodaj stvarni URL projekta i anon ključ u <code>.env.local</code>. Javni delovi aplikacije su već dostupni.</p><div><a href="/join">Prijava volontera</a><a href="/donate">Donacije</a></div></div></main>;
  }
  if (access === "checking") return <main className="setup-screen"><LoaderCircle className="spin" /><p>Proveravamo pristup…</p></main>;
  if (access === "pending" || access === "rejected" || access === "error") {
    const pending = access === "pending";
    return <main className="setup-screen"><div className="setup-card"><span className="brand-mark"><Compass /></span><p className="eyebrow">STATUS NALOGA</p><h1>{pending ? "Nalog čeka odobrenje" : access === "rejected" ? "Pristup nalogu je odbijen" : "Pristup nije moguće proveriti"}</h1><p>{pending ? "Administrator će pregledati tvoju registraciju. Pristup terenskim podacima biće omogućen nakon odobrenja." : access === "rejected" ? "Obrati se regionalnom koordinatoru ako smatraš da je ovo greška." : message}</p><div><button type="button" onClick={signOut}>Odjavi se</button><a href="/join">Javna prijava volontera</a></div></div></main>;
  }
  return children;
}
