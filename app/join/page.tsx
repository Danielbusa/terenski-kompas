"use client";

import { useState, type FormEvent } from "react";
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
import { useLanguage } from "@/components/language-provider";

export default function JoinPage() {
  const { t } = useLanguage();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
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
    setSubmitError("");
    const supabase = getSupabase();
    if (!supabase || !navigator.onLine) {
      await enqueue("recruits", payload);
      setBusy(false); setDone(true);
      toast.success(t("Prijava je bezbedno sačuvana i čeka sinhronizaciju.", "Your signup is safely queued for sync."));
      return;
    }
    try {
      const { error } = await supabase.from("recruits").insert(payload);
      if (error) {
        setSubmitError(error.message);
        toast.error(t("Prijava trenutno nije poslata.", "Signup was not submitted."), { description: error.message });
      } else {
        setDone(true);
        toast.success(t("Prijava je uspešno poslata.", "Signup submitted successfully."));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("Nepoznata greška pri slanju.", "Unknown submission error.");
      setSubmitError(message);
      toast.error(t("Prijava trenutno nije poslata.", "Signup was not submitted."), { description: message });
    } finally {
      setBusy(false);
    }
  }
  return <div className="public-page"><PublicHeader /><main className="join-layout"><section className="join-copy"><p className="eyebrow">STUDENT U SVAKOM SELU</p><h1>{t("Promena počinje tamo gde živiš.", "Change starts where you live.")}</h1><p>{t("Pridruži se mreži studenata i građana koji razgovaraju sa komšijama, mapiraju potrebe zajednice i čuvaju svaki glas.", "Join students and citizens who talk with neighbors, map community needs, and protect every vote.")}</p><div className="join-points"><span><i><MapPin /></i><b>{t("Biraj svoj kraj", "Choose your area")}<small>{t("Radi u svom naselju i svojim tempom.", "Work locally, at your own pace.")}</small></b></span><span><i><ShieldCheck /></i><b>{t("Dobijaš obuku", "Get trained")}<small>{t("Jasna pravila, podrška i bezbedan rad.", "Clear rules, support, and safe work.")}</small></b></span><span><i><UserPlus /></i><b>{t("Postani deo mreže", "Join the network")}<small>{t("Koordinator će te kontaktirati sa sledećim korakom.", "A coordinator will contact you with next steps.")}</small></b></span></div></section>
    <section className="join-card">{done ? <div className="success-state"><span><Check /></span><h2>{t("Prijava je primljena.", "Signup received.")}</h2><p>{t("Regionalni koordinator će ti se javiti sa informacijama o kratkoj obuci i prvom zadatku.", "A regional coordinator will contact you about training and your first task.")}</p><a href="/donate">{t("Podrži kampanju donacijom", "Support the campaign")} <ArrowRight /></a></div> : <><p className="eyebrow">{t("PRIJAVA VOLONTERA", "VOLUNTEER SIGNUP")}</p><h2>{t("Uključi se u svoju zajednicu", "Join your community")}</h2><p>{t("Potrebno je manje od dva minuta.", "It takes less than two minutes.")}</p><form onSubmit={submit} className="join-form"><div><Label htmlFor="full_name">{t("Ime i prezime", "Full name")}</Label><Input id="full_name" name="full_name" required /></div><div><Label htmlFor="phone_number">{t("Broj telefona", "Phone number")}</Label><Input id="phone_number" name="phone_number" type="tel" placeholder="+381 6…" required /></div><div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" /></div><div><Label htmlFor="city_village">{t("Grad ili selo", "City or village")}</Label><Input id="city_village" name="city_village" required /></div><label className="check-row"><Checkbox name="poll_watching" /><span>{t("Zainteresovan/a sam i za kontrolu izbora.", "I am also interested in poll watching.")}</span></label><label className="check-row"><Checkbox required /><span>{t("Saglasan/na sam da SUSS koristi moje podatke isključivo radi organizacije volontiranja.", "I agree that SUSS may use my data only to organize volunteering.")}</span></label>{submitError && <p className="form-status error" role="alert">{submitError}</p>}<Button type="submit" size="lg" disabled={busy}>{busy ? t("Čuvanje…", "Saving…") : t("Pošalji prijavu", "Submit signup")}<ArrowRight /></Button></form></>}</section>
  </main><Toaster richColors position="top-center" /></div>;
}
