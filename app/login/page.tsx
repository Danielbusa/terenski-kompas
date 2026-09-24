"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, KeyRound, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useLanguage } from "@/components/language-provider";
import { EducationSelect } from "@/components/education-select";
import { LocationSelect } from "@/components/location-select";

type AuthMode = "password" | "signup" | "magic";
type Status = { tone: "error" | "success"; text: string } | null;

function nextPath() {
  const value = new URLSearchParams(window.location.search).get("next") ?? "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function LoginPage() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<AuthMode>("password");
  const [status, setStatus] = useState<Status>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) {
      const text = t("Prijava trenutno nije dostupna. Veza nije podešena.", "Sign-in is unavailable because the connection is not configured.");
      setStatus({ tone: "error", text });
      toast.error(text);
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("full_name") ?? "").trim();
    const universityId = String(form.get("university_id") ?? "");
    const facultyId = String(form.get("faculty_id") ?? "");
    const locationId = Number(form.get("location_id")) || null;
    const cityVillage = String(form.get("city_village") ?? "");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}${mode === "magic" ? "&setup=password" : ""}`;
    setBusy(true);
    setStatus(null);

    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
        });
        if (error) throw error;
        const text = t("Magic link je poslat. Otvori poruku na istoj adresi da završiš prijavu.", "Magic link sent. Open the email to complete sign-in.");
        setStatus({ tone: "success", text });
        toast.success(t("Magic link je poslat.", "Magic link sent."), { description: t("Proveri i spam folder.", "Check your spam folder too.") });
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo, data: { full_name: fullName, university_id: universityId || null, faculty_id: facultyId || null, location_id: locationId, assigned_region: cityVillage } },
        });
        if (error) throw error;
        if (data.session) {
          toast.success(t("Nalog je napravljen.", "Account created."));
          window.location.replace(nextPath());
          return;
        }
        const text = t("Nalog je napravljen. Potvrdi email preko poruke koju smo poslali, pa se vrati na prijavu.", "Account created. Confirm your email, then return to sign in.");
        setStatus({ tone: "success", text });
        toast.success(t("Proveri svoju email adresu.", "Check your email."), { description: t("Potvrda je potrebna pre prve prijave.", "Confirmation is required before first sign-in.") });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success(t("Uspešno si prijavljen/a.", "Signed in successfully."));
      window.location.replace(nextPath());
    } catch (error) {
      const details = error instanceof Error ? error.message : t("Prijava nije završena.", "Sign-in was not completed.");
      setStatus({ tone: "error", text: details });
      toast.error(t("Prijava nije završena.", "Sign-in was not completed."), { description: details });
    } finally {
      setBusy(false);
    }
  }

  const buttonLabel = busy
    ? t("Povezivanje…", "Connecting…")
    : mode === "magic"
      ? t("Pošalji magic link", "Send magic link")
      : mode === "signup"
        ? t("Napravi nalog", "Create account")
        : t("Prijavi se", "Sign in");

  return <div className="public-page"><PublicHeader /><main className="auth-layout"><section className="auth-intro"><p className="eyebrow">{t("PRIVATNI RADNI PROSTOR", "PRIVATE WORKSPACE")}</p><h1>{t("Terenski podaci ostaju u timu.", "Field data stays with the team.")}</h1><p>{t("Prijavi se da pristupiš mapama obilaska, izveštajima sa biračkih mesta i koordinaciji kampanje.", "Sign in to access canvassing maps, polling reports, and campaign coordination.")}</p><div className="trust-row"><ShieldCheck /><span><b>{t("Pristup po ulozi", "Role-based access")}</b><small>{t("Svako vidi samo podatke potrebne za svoj zadatak.", "Everyone sees only the data needed for their role.")}</small></span></div></section>
    <Card className="auth-card"><div className="auth-icon">{mode === "signup" ? <UserPlus /> : <KeyRound />}</div><h2>{mode === "signup" ? t("Napravi nalog", "Create account") : t("Prijava u aplikaciju", "Sign in")}</h2><p>{isSupabaseConfigured ? t("Koristi email nalog ili zatraži bezbedan magic link.", "Use email and password or request a secure magic link.") : t("Veza još nije podešena.", "The connection is not configured yet.")}</p>
      <Tabs value={mode} onValueChange={(value) => { setMode(value as AuthMode); setStatus(null); }}><TabsList className="auth-tabs"><TabsTrigger value="password">{t("Prijava", "Sign in")}</TabsTrigger><TabsTrigger value="signup">{t("Registracija", "Register")}</TabsTrigger><TabsTrigger value="magic">Magic link</TabsTrigger></TabsList><TabsContent value="password" /><TabsContent value="signup" /><TabsContent value="magic" /></Tabs>
      <form onSubmit={submit} className="auth-form">{mode === "signup" && <><div><Label htmlFor="full_name">{t("Ime i prezime", "Full name")}</Label><Input id="full_name" name="full_name" autoComplete="name" required /></div><div><Label>{t("Grad, opština ili selo","City, municipality, or village")}</Label><LocationSelect required/></div><EducationSelect /></>}<div><Label htmlFor="email">{t("Email adresa", "Email address")}</Label><Input id="email" name="email" type="email" autoComplete="email" placeholder="ime@primer.rs" required /></div>{mode !== "magic" && <div><Label htmlFor="password">{t("Lozinka", "Password")}</Label><Input id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required /></div>}{status && <p className={`form-status ${status.tone}`} role={status.tone === "error" ? "alert" : "status"}>{status.text}</p>}<Button type="submit" size="lg" disabled={busy}>{buttonLabel}<ArrowRight /></Button></form>
      <div className="public-shortcuts"><a href="/join"><Mail /> {t("Postani volonter", "Join us")}</a><a href="/donate">{t("Doniraj kampanji", "Donate")}</a></div>
    </Card></main><Toaster richColors position="top-center" /></div>;
}
