"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("password");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) {
      toast.error("Dodaj Supabase podatke u .env.local pre prijave.");
      return;
    }
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    setBusy(true);
    if (mode === "magic") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(params.get("next") ?? "/")}` },
      });
      setBusy(false);
      if (error) toast.error(error.message);
      else toast.success("Poslali smo bezbedan link na tvoju adresu.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error("Proveri email i lozinku.");
    else router.replace(params.get("next") ?? "/");
  }

  return <div className="public-page"><PublicHeader /><main className="auth-layout"><section className="auth-intro"><p className="eyebrow">PRIVATNI RADNI PROSTOR</p><h1>Terenski podaci ostaju u timu.</h1><p>Prijavi se da pristupiš mapama obilaska, izveštajima sa biračkih mesta i koordinaciji kampanje.</p><div className="trust-row"><ShieldCheck /><span><b>Pristup po ulozi</b><small>Svako vidi samo podatke potrebne za svoj zadatak.</small></span></div></section>
    <section className="auth-card"><div className="auth-icon"><KeyRound /></div><h2>Prijava u aplikaciju</h2><p>{isSupabaseConfigured ? "Koristi nalog koji ti je dodelio koordinator." : "Supabase još nije povezan. Javni delovi aplikacije i dalje rade."}</p>
      <Tabs value={mode} onValueChange={setMode}><TabsList className="auth-tabs"><TabsTrigger value="password">Email i lozinka</TabsTrigger><TabsTrigger value="magic">Magic link</TabsTrigger></TabsList><TabsContent value="password" /><TabsContent value="magic" /></Tabs>
      <form onSubmit={submit} className="auth-form"><div><Label htmlFor="email">Email adresa</Label><Input id="email" name="email" type="email" autoComplete="email" placeholder="ime@primer.rs" required /></div>{mode === "password" && <div><Label htmlFor="password">Lozinka</Label><Input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required /></div>}<Button type="submit" size="lg" disabled={busy}>{busy ? "Povezivanje…" : mode === "magic" ? "Pošalji magic link" : "Prijavi se"}<ArrowRight /></Button></form>
      <div className="public-shortcuts"><Link href="/join"><Mail /> Postani volonter</Link><Link href="/donate">Doniraj kampanji</Link></div>
    </section></main><Toaster richColors position="top-center" /></div>;
}
