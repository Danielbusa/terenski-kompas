"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Compass, LoaderCircle } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { flushQueue } from "@/lib/offline-queue";
import { useLanguage } from "@/components/language-provider";
import { Card } from "@/components/ui/card";

type AccessState = "checking" | "approved" | "pending" | "rejected" | "error";

export function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
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
    return <main className="setup-screen"><Card className="setup-card"><span className="brand-mark"><Compass /></span><p className="eyebrow">{t("POTREBNO POVEZIVANJE", "CONNECTION REQUIRED")}</p><h1>{t("Dashboard čeka Supabase podatke", "The dashboard is waiting for Supabase")}</h1><p>{t("Veza sa bazom nije podešena.", "The database connection is not configured.")}</p><div><a href="/join">{t("Prijava volontera", "Volunteer signup")}</a><a href="/donate">{t("Donacije", "Donations")}</a></div></Card></main>;
  }
  if (access === "checking") return <main className="setup-screen"><LoaderCircle className="spin" /><p>{t("Proveravamo pristup…", "Checking access…")}</p></main>;
  if (access === "pending" || access === "rejected" || access === "error") {
    const pending = access === "pending";
    return <main className="setup-screen"><Card className="setup-card"><span className="brand-mark"><Compass /></span><p className="eyebrow">{t("STATUS NALOGA", "ACCOUNT STATUS")}</p><h1>{pending ? t("Nalog čeka odobrenje", "Account pending approval") : access === "rejected" ? t("Pristup nalogu je odbijen", "Account access rejected") : t("Pristup nije moguće proveriti", "Access could not be verified")}</h1><p>{pending ? t("Administrator će pregledati tvoju registraciju. Pristup terenskim podacima biće omogućen nakon odobrenja.", "An administrator will review your registration. Field data will unlock after approval.") : access === "rejected" ? t("Obrati se regionalnom koordinatoru ako smatraš da je ovo greška.", "Contact your regional coordinator if you believe this is a mistake.") : message}</p><div><button type="button" onClick={signOut}>{t("Odjavi se", "Sign out")}</button><a href="/join">{t("Javna prijava volontera", "Public volunteer signup")}</a></div></Card></main>;
  }
  return children;
}
