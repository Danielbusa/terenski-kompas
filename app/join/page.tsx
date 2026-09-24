"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check, MapPin, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { enqueue } from "@/lib/offline-queue";
import { getSupabase } from "@/lib/supabase/client";

export default function JoinPage() {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      full_name: String(form.get("full_name") ?? "").trim(),
      phone_number: String(form.get("phone_number") ?? "").trim(),
      email: String(form.get("email") ?? "").trim() || null,
      city_village: String(form.get("city_village") ?? "").trim(),
      interested_in_poll_watching: form.get("poll_watching") === "on",
      recruiter_id: null,
      source: "public_join",
    };
    setBusy(true);
    const supabase = getSupabase();
    if (!supabase || !navigator.onLine) {
      await enqueue("recruits", payload);
      setBusy(false); setDone(true);
      toast.success("Prijava je bezbedno sačuvana i čeka sinhronizaciju.");
      return;
    }
    const { error } = await supabase.from("recruits").insert(payload);
    setBusy(false);
    if (error) toast.error("Prijava trenutno nije poslata. Pokušaj ponovo.");
    else setDone(true);
  }
  return <div className="public-page"><PublicHeader /><main className="join-layout"><section className="join-copy"><p className="eyebrow">STUDENT U SVAKOM SELU</p><h1>Promena počinje tamo gde živiš.</h1><p>Pridruži se mreži studenata i građana koji razgovaraju sa komšijama, mapiraju potrebe zajednice i čuvaju svaki glas.</p><div className="join-points"><span><i><MapPin /></i><b>Biraj svoj kraj<small>Radi u svom naselju i svojim tempom.</small></b></span><span><i><ShieldCheck /></i><b>Dobijaš obuku<small>Jasna pravila, podrška i bezbedan rad.</small></b></span><span><i><UserPlus /></i><b>Postani deo mreže<small>Koordinator će te kontaktirati sa sledećim korakom.</small></b></span></div></section>
    <section className="join-card">{done ? <div className="success-state"><span><Check /></span><h2>Prijava je primljena.</h2><p>Regionalni koordinator će ti se javiti sa informacijama o kratkoj obuci i prvom zadatku.</p><Link href="/donate">Podrži kampanju donacijom <ArrowRight /></Link></div> : <><p className="eyebrow">PRIJAVA VOLONTERA</p><h2>Uključi se u svoju zajednicu</h2><p>Potrebno je manje od dva minuta.</p><form onSubmit={submit} className="join-form"><div><Label htmlFor="full_name">Ime i prezime</Label><Input id="full_name" name="full_name" required /></div><div><Label htmlFor="phone_number">Broj telefona</Label><Input id="phone_number" name="phone_number" type="tel" placeholder="+381 6…" required /></div><div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div><div><Label htmlFor="city_village">Grad ili selo</Label><Input id="city_village" name="city_village" required /></div><label className="check-row"><Checkbox name="poll_watching" /><span>Zainteresovan/a sam i za kontrolu izbora.</span></label><label className="check-row"><Checkbox required /><span>Saglasan/na sam da SUSS koristi moje podatke isključivo radi organizacije volontiranja.</span></label><Button type="submit" size="lg" disabled={busy}>{busy ? "Čuvanje…" : "Pošalji prijavu"}<ArrowRight /></Button></form></>}</section>
  </main><Toaster richColors position="top-center" /></div>;
}
