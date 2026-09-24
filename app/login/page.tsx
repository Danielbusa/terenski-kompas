"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, KeyRound, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

type AuthMode = "password" | "signup" | "magic";
type Status = { tone: "error" | "success"; text: string } | null;

function nextPath() {
  const value = new URLSearchParams(window.location.search).get("next") ?? "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<AuthMode>("password");
  const [status, setStatus] = useState<Status>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) {
      const text = "Prijava trenutno nije dostupna. Supabase veza nije podešena.";
      setStatus({ tone: "error", text });
      toast.error(text);
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("full_name") ?? "").trim();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}`;
    setBusy(true);
    setStatus(null);

    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
        });
        if (error) throw error;
        const text = "Magic link je poslat. Otvori poruku na istoj adresi da završiš prijavu.";
        setStatus({ tone: "success", text });
        toast.success("Magic link je poslat.", { description: "Proveri i spam folder." });
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo, data: { full_name: fullName } },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Nalog je napravljen. Dobro došao/la!");
          window.location.replace(nextPath());
          return;
        }
        const text = "Nalog je napravljen. Potvrdi email preko poruke koju smo poslali, pa se vrati na prijavu.";
        setStatus({ tone: "success", text });
        toast.success("Proveri svoju email adresu.", { description: "Potvrda je potrebna pre prve prijave." });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Uspešno si prijavljen/a.");
      window.location.replace(nextPath());
    } catch (error) {
      const details = error instanceof Error ? error.message : "Prijava nije završena.";
      setStatus({ tone: "error", text: details });
      toast.error("Prijava nije završena.", { description: details });
    } finally {
      setBusy(false);
    }
  }

  const buttonLabel = busy
    ? "Povezivanje…"
    : mode === "magic"
      ? "Pošalji magic link"
      : mode === "signup"
        ? "Napravi nalog"
        : "Prijavi se";

  return <div className="public-page"><PublicHeader /><main className="auth-layout"><section className="auth-intro"><p className="eyebrow">PRIVATNI RADNI PROSTOR</p><h1>Terenski podaci ostaju u timu.</h1><p>Prijavi se da pristupiš mapama obilaska, izveštajima sa biračkih mesta i koordinaciji kampanje.</p><div className="trust-row"><ShieldCheck /><span><b>Pristup po ulozi</b><small>Svako vidi samo podatke potrebne za svoj zadatak.</small></span></div></section>
    <section className="auth-card"><div className="auth-icon">{mode === "signup" ? <UserPlus /> : <KeyRound />}</div><h2>{mode === "signup" ? "Napravi nalog" : "Prijava u aplikaciju"}</h2><p>{isSupabaseConfigured ? "Koristi email nalog ili zatraži bezbedan magic link." : "Supabase još nije povezan. Javni delovi aplikacije i dalje rade."}</p>
      <Tabs value={mode} onValueChange={(value) => { setMode(value as AuthMode); setStatus(null); }}><TabsList className="auth-tabs"><TabsTrigger value="password">Prijava</TabsTrigger><TabsTrigger value="signup">Registracija</TabsTrigger><TabsTrigger value="magic">Magic link</TabsTrigger></TabsList><TabsContent value="password" /><TabsContent value="signup" /><TabsContent value="magic" /></Tabs>
      <form onSubmit={submit} className="auth-form">{mode === "signup" && <div><Label htmlFor="full_name">Ime i prezime</Label><Input id="full_name" name="full_name" autoComplete="name" required /></div>}<div><Label htmlFor="email">Email adresa</Label><Input id="email" name="email" type="email" autoComplete="email" placeholder="ime@primer.rs" required /></div>{mode !== "magic" && <div><Label htmlFor="password">Lozinka</Label><Input id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required /></div>}{status && <p className={`form-status ${status.tone}`} role={status.tone === "error" ? "alert" : "status"}>{status.text}</p>}<Button type="submit" size="lg" disabled={busy}>{buttonLabel}<ArrowRight /></Button></form>
      <div className="public-shortcuts"><a href="/join"><Mail /> Postani volonter</a><a href="/donate">Doniraj kampanji</a></div>
    </section></main><Toaster richColors position="top-center" /></div>;
}
