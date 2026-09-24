"use client";

/* eslint-disable @next/next/no-html-link-for-pages */

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Check, ClipboardList, Compass, LoaderCircle, MapPin, Receipt, RefreshCw, ShieldCheck, UserCheck, UserPlus, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { LanguageToggle, useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

type ApprovalStatus = "pending" | "approved" | "rejected";
type Role = "admin" | "coordinator" | "canvasser" | "poll_watcher";
type Profile = { id: string; full_name: string; email: string | null; phone_number: string | null; role: Role; assigned_region: string | null; faculty: string | null; approval_status: ApprovalStatus; created_at: string };
type Recruit = { id: string; full_name: string; phone_number: string; email: string | null; city_village: string; interested_in_poll_watching: boolean; created_at: string };
type Expense = { id: string; user_id: string; origin: string; destination: string; travel_date: string; amount_rsd: number; receipt_path: string | null; status: "pending_review" | "approved" | "rejected" | "paid"; admin_note: string | null; profiles: { full_name: string } | null };
type Counts = { visits: number; tasks: number; incidents: number };

export default function AdminPage() {
  const { t, language } = useLanguage();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [recruits, setRecruits] = useState<Recruit[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [counts, setCounts] = useState<Counts>({ visits: 0, tasks: 0, incidents: 0 });
  const [currentUserId, setCurrentUserId] = useState("");
  const [access, setAccess] = useState<"checking" | "granted" | "denied" | "error">("checking");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadAdminData = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setLoading(true);
    const [profileResult, recruitResult, expenseResult, visitsResult, tasksResult, incidentsResult] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,phone_number,role,assigned_region,faculty,approval_status,created_at").order("created_at", { ascending: false }),
      supabase.from("recruits").select("id,full_name,phone_number,email,city_village,interested_in_poll_watching,created_at").order("created_at", { ascending: false }).limit(250),
      supabase.from("travel_expenses").select("id,user_id,origin,destination,travel_date,amount_rsd,receipt_path,status,admin_note,profiles!travel_expenses_user_id_fkey(full_name)").order("created_at", { ascending: false }).limit(250),
      supabase.from("visits").select("id", { count: "exact", head: true }),
      supabase.from("field_tasks").select("id", { count: "exact", head: true }),
      supabase.from("incidents").select("id", { count: "exact", head: true }),
    ]);
    const error = [profileResult, recruitResult, expenseResult, visitsResult, tasksResult, incidentsResult].find((item) => item.error)?.error;
    if (error) { setMessage(error.message); toast.error(t("Administratorski podaci nisu učitani.", "Admin data could not be loaded."), { description: error.message }); }
    else setMessage("");
    setProfiles((profileResult.data ?? []) as Profile[]);
    setRecruits((recruitResult.data ?? []) as Recruit[]);
    setExpenses((expenseResult.data ?? []).map((item) => ({ ...item, amount_rsd: Number(item.amount_rsd), profiles: Array.isArray(item.profiles) ? item.profiles[0] ?? null : item.profiles })) as Expense[]);
    setCounts({ visits: visitsResult.count ?? 0, tasks: tasksResult.count ?? 0, incidents: incidentsResult.count ?? 0 });
    setLoading(false);
  }, [t]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) { window.location.replace("/login?next=/admin"); return; }
      const response = await fetch("/api/admin/authorize", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) { setAccess(response.status === 403 ? "denied" : "error"); setLoading(false); return; }
      const body = await response.json() as { userId: string };
      setCurrentUserId(body.userId);
      setAccess("granted");
      await loadAdminData();
    })().catch((error: Error) => { setMessage(error.message); setAccess("error"); setLoading(false); });
  }, [loadAdminData]);

  const totals = useMemo(() => ({ pending: profiles.filter((p) => p.approval_status === "pending").length, approved: profiles.filter((p) => p.approval_status === "approved").length, rejected: profiles.filter((p) => p.approval_status === "rejected").length }), [profiles]);

  const changeStatus = async (profile: Profile, next: ApprovalStatus) => {
    if (profile.id === currentUserId && next !== "approved") return toast.error(t("Ne možeš ukinuti sopstveno administratorsko odobrenje.", "You cannot revoke your own admin approval."));
    setBusyId(profile.id);
    const { error } = await getSupabase()!.rpc("admin_set_profile_approval", { target_user_id: profile.id, new_status: next });
    if (error) toast.error(t("Status nije promenjen.", "Status was not changed."), { description: error.message });
    else { setProfiles((all) => all.map((p) => p.id === profile.id ? { ...p, approval_status: next } : p)); toast.success(t("Status je ažuriran.", "Status updated.")); }
    setBusyId(null);
  };

  const updateProfile = async (event: FormEvent<HTMLFormElement>, profile: Profile) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyId(profile.id);
    const { error } = await getSupabase()!.rpc("admin_update_profile", { target_user_id: profile.id, new_role: String(form.get("role")), new_region: String(form.get("region") ?? ""), new_faculty: String(form.get("faculty") ?? "") });
    if (error) toast.error(t("Profil nije ažuriran.", "Profile was not updated."), { description: error.message });
    else { toast.success(t("Profil je ažuriran.", "Profile updated.")); await loadAdminData(); }
    setBusyId(null);
  };

  const reviewExpense = async (expense: Expense, status: Expense["status"]) => {
    const note = window.prompt(t("Napomena administratora (opciono)", "Admin note (optional)"), expense.admin_note ?? "") ?? expense.admin_note;
    setBusyId(expense.id);
    const { error } = await getSupabase()!.rpc("admin_review_expense", { target_expense_id: expense.id, new_status: status, review_note: note });
    if (error) toast.error(t("Trošak nije ažuriran.", "Expense was not updated."), { description: error.message });
    else { toast.success(t("Status troška je ažuriran.", "Expense status updated.")); await loadAdminData(); }
    setBusyId(null);
  };

  const openReceipt = async (expense: Expense) => {
    if (!expense.receipt_path) return;
    const { data, error } = await getSupabase()!.storage.from("expense-receipts").createSignedUrl(expense.receipt_path, 120);
    if (error) toast.error(t("Račun nije dostupan.", "Receipt is unavailable."), { description: error.message });
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const createTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const element = event.currentTarget; const form = new FormData(element);
    const payload = { assigned_to: String(form.get("assigned_to")), title: String(form.get("title")).trim(), address: String(form.get("address")).trim(), city_village: String(form.get("city_village")).trim(), latitude: Number(form.get("latitude")), longitude: Number(form.get("longitude")), due_date: String(form.get("due_date")) || null, notes: String(form.get("notes")).trim() || null, created_by: currentUserId };
    const { error } = await getSupabase()!.from("field_tasks").insert(payload);
    if (error) toast.error(t("Zadatak nije kreiran.", "Task was not created."), { description: error.message }); else { toast.success(t("Terenski zadatak je dodeljen.", "Field task assigned.")); element.reset(); await loadAdminData(); }
  };

  const createStation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const element = event.currentTarget; const form = new FormData(element);
    const payload = { station_number: String(form.get("station_number")).trim(), municipality: String(form.get("municipality")).trim(), address: String(form.get("address")).trim(), latitude: Number(form.get("latitude")), longitude: Number(form.get("longitude")), coordinator_name: String(form.get("coordinator_name")).trim() || null, coordinator_phone: String(form.get("coordinator_phone")).trim() || null, notes: String(form.get("notes")).trim() || null };
    const { error } = await getSupabase()!.from("polling_stations").insert(payload);
    if (error) toast.error(t("Biračko mesto nije sačuvano.", "Polling station was not saved."), { description: error.message }); else { toast.success(t("Biračko mesto je dodato.", "Polling station added.")); element.reset(); }
  };

  const signOut = async () => { await getSupabase()?.auth.signOut(); window.location.href = "/login"; };
  if (!isSupabaseConfigured || access === "error") return <AccessScreen title={t("Admin portal nije dostupan", "Admin portal unavailable")} text={message || t("Veza nije dostupna.", "Connection unavailable.")} />;
  if (access === "checking") return <main className="setup-screen"><LoaderCircle className="spin" /><p>{t("Proveravamo administratorski pristup…", "Checking admin access…")}</p></main>;
  if (access === "denied") return <AccessScreen title={t("Pristup nije dozvoljen", "Access denied")} text={t("Ova stranica je samo za odobrene administratore.", "This page is only for approved administrators.")} />;

  const approvedProfiles = profiles.filter((p) => p.approval_status === "approved");
  return <div className="admin-shell"><header className="admin-header"><a href="/" className="admin-brand"><span className="brand-mark"><Compass /></span><span><b>Terenski Kompas</b><small>ADMIN PORTAL</small></span></a><div><LanguageToggle compact /><a href="/"><ArrowLeft /> Dashboard</a><button type="button" onClick={signOut}>{t("Odjavi se", "Sign out")}</button></div></header><main className="admin-main">
    <div className="admin-title"><div><p className="eyebrow">{t("CENTRALA", "ADMIN CENTER")}</p><h1>{t("Operativna kontrola", "Operations control")}</h1><p>{t("Stvarni korisnici, zadaci, prijave i refundacije iz Supabase baze.", "Live users, tasks, reports, and reimbursements from Supabase.")}</p></div><Button variant="outline" onClick={() => void loadAdminData()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} /> {t("Osveži", "Refresh")}</Button></div>
    <section className="admin-stats"><StatCard icon={<Users />} label={t("Odobreni", "Approved")} value={totals.approved} /><StatCard icon={<UserPlus />} label={t("Čekaju", "Pending")} value={totals.pending} tone="pending" /><StatCard icon={<ClipboardList />} label={t("Zadaci", "Tasks")} value={counts.tasks} /><StatCard icon={<Check />} label={t("Posete", "Visits")} value={counts.visits} /><StatCard icon={<ShieldCheck />} label={t("Incidenti", "Incidents")} value={counts.incidents} /></section>
    <section className="admin-panel"><div className="admin-panel-head"><div><h2>{t("Korisnički nalozi", "User accounts")}</h2><p>{t("Odobravanje, uloge, regioni i fakulteti.", "Approvals, roles, regions, and faculties.")}</p></div><span><ShieldCheck /> {t("Zaštićeno RLS pravilima", "Protected by RLS")}</span></div>{message && <p className="form-status error">{message}</p>}{loading ? <div className="admin-loading"><LoaderCircle className="spin" /> {t("Učitavanje…", "Loading…")}</div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{t("Volonter", "Volunteer")}</th><th>{t("Profil", "Profile")}</th><th>{t("Datum", "Date")}</th><th>{t("Odobrenje", "Approval")}</th></tr></thead><tbody>{profiles.map((profile) => <tr key={profile.id}><td><span className="profile-cell"><span className="profile-avatar">{initials(profile.full_name)}</span><span><b>{profile.full_name}</b><small>{profile.email || profile.phone_number || t("Bez kontakta", "No contact")}</small></span></span></td><td><form className="profile-admin-form" onSubmit={(event) => void updateProfile(event, profile)}><Select name="role" defaultValue={profile.role}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="canvasser">{t("Volonter", "Canvasser")}</SelectItem><SelectItem value="poll_watcher">{t("Kontrolor", "Poll watcher")}</SelectItem><SelectItem value="coordinator">{t("Koordinator", "Coordinator")}</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select><Input name="region" defaultValue={profile.assigned_region ?? ""} placeholder={t("Region", "Region")} /><Input name="faculty" defaultValue={profile.faculty ?? ""} placeholder={t("Fakultet", "Faculty")} /><Button size="sm" variant="outline" disabled={busyId === profile.id}>{t("Sačuvaj", "Save")}</Button></form></td><td>{new Intl.DateTimeFormat(language === "sr" ? "sr-RS" : "en-GB", { dateStyle: "medium" }).format(new Date(profile.created_at))}</td><td><div className="approval-actions"><span className={`status-pill ${profile.approval_status}`}>{approvalLabel(profile.approval_status, language)}</span>{profile.approval_status !== "approved" && <Button size="sm" onClick={() => void changeStatus(profile, "approved")} disabled={busyId === profile.id}><UserCheck /> {t("Odobri", "Approve")}</Button>}{profile.approval_status !== "rejected" && <Button size="sm" variant="outline" onClick={() => void changeStatus(profile, "rejected")} disabled={busyId === profile.id}><UserX /> {t("Odbij", "Reject")}</Button>}</div></td></tr>)}</tbody></table></div>}</section>
    <div className="admin-grid"><AdminForm title={t("Dodeli terenski zadatak", "Assign field task")} icon={<ClipboardList />} onSubmit={createTask}><Field label={t("Volonter", "Volunteer")}><Select name="assigned_to" required><SelectTrigger><SelectValue placeholder={t("Izaberi", "Choose")} /></SelectTrigger><SelectContent>{approvedProfiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent></Select></Field><Field label={t("Naslov", "Title")}><Input name="title" required /></Field><Field label={t("Adresa", "Address")}><Input name="address" required /></Field><Field label={t("Mesto", "City or village")}><Input name="city_village" required /></Field><Field label="Latitude"><Input name="latitude" type="number" step="any" required /></Field><Field label="Longitude"><Input name="longitude" type="number" step="any" required /></Field><Field label={t("Rok", "Due date")}><Input name="due_date" type="date" /></Field><Field label={t("Napomena", "Notes")}><Textarea name="notes" /></Field><Button type="submit">{t("Dodeli zadatak", "Assign task")}</Button></AdminForm>
    <AdminForm title={t("Dodaj biračko mesto", "Add polling station")} icon={<MapPin />} onSubmit={createStation}><Field label={t("Broj", "Number")}><Input name="station_number" required /></Field><Field label={t("Opština", "Municipality")}><Input name="municipality" required /></Field><Field label={t("Adresa", "Address")}><Input name="address" required /></Field><Field label="Latitude"><Input name="latitude" type="number" step="any" required /></Field><Field label="Longitude"><Input name="longitude" type="number" step="any" required /></Field><Field label={t("Koordinator", "Coordinator")}><Input name="coordinator_name" /></Field><Field label={t("Telefon", "Phone")}><Input name="coordinator_phone" /></Field><Field label={t("Napomena", "Notes")}><Textarea name="notes" /></Field><Button type="submit">{t("Sačuvaj biračko mesto", "Save polling station")}</Button></AdminForm></div>
    <section className="admin-panel"><div className="admin-panel-head"><div><h2>{t("Putni troškovi", "Travel expenses")}</h2><p>{t("Pregled računa i promena statusa refundacije.", "Review receipts and reimbursement status.")}</p></div><Receipt /></div>{expenses.length === 0 ? <AdminEmpty text={t("Nema prijavljenih troškova.", "No submitted expenses.")} /> : <div className="expense-admin-list">{expenses.map((expense) => <article key={expense.id}><div><b>{expense.profiles?.full_name ?? expense.user_id}</b><p>{expense.origin} → {expense.destination} · {expense.travel_date}</p></div><strong>{expense.amount_rsd.toLocaleString(language === "sr" ? "sr-RS" : "en-GB")} RSD</strong><span className={`status-pill ${expense.status}`}>{expense.status.replaceAll("_", " ")}</span>{expense.receipt_path && <Button size="sm" variant="outline" onClick={() => void openReceipt(expense)}>{t("Račun", "Receipt")}</Button>}<div className="approval-actions"><Button size="sm" onClick={() => void reviewExpense(expense, "approved")} disabled={busyId === expense.id}>{t("Odobri", "Approve")}</Button><Button size="sm" variant="outline" onClick={() => void reviewExpense(expense, "rejected")} disabled={busyId === expense.id}>{t("Odbij", "Reject")}</Button><Button size="sm" variant="outline" onClick={() => void reviewExpense(expense, "paid")} disabled={busyId === expense.id}>{t("Isplaćeno", "Paid")}</Button></div></article>)}</div>}</section>
    <section className="admin-panel"><div className="admin-panel-head"><div><h2>{t("Javne prijave volontera", "Public volunteer leads")}</h2><p>{t("Prijave poslate preko javne /join stranice.", "Submissions received through the public /join page.")}</p></div><UserPlus /></div>{recruits.length === 0 ? <AdminEmpty text={t("Nema javnih prijava.", "No public signups.")} /> : <div className="recruit-grid">{recruits.map((r) => <article key={r.id}><b>{r.full_name}</b><p>{r.city_village} · {r.phone_number}</p><small>{r.email || t("Bez emaila", "No email")} {r.interested_in_poll_watching ? `· ${t("Kontrolor", "Poll watcher")}` : ""}</small></article>)}</div>}</section>
  </main><Toaster richColors position="top-center" /></div>;
}

function AccessScreen({ title, text }: { title: string; text: string }) { return <main className="setup-screen"><div className="setup-card"><span className="brand-mark"><ShieldCheck /></span><p className="eyebrow">ADMIN</p><h1>{title}</h1><p>{text}</p><div><a href="/">Dashboard</a></div></div></main>; }
function StatCard({ icon, label, value, tone = "" }: { icon: ReactNode; label: string; value: number; tone?: string }) { return <div className={`admin-stat ${tone}`}><span>{icon}</span><div><strong>{value}</strong><p>{label}</p></div></div>; }
function AdminForm({ title, icon, onSubmit, children }: { title: string; icon: ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void; children: ReactNode }) { return <section className="admin-panel"><div className="admin-panel-head"><h2>{title}</h2>{icon}</div><form className="admin-entry-form" onSubmit={onSubmit}>{children}</form></section>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label><Label>{label}</Label>{children}</label>; }
function AdminEmpty({ text }: { text: string }) { return <div className="admin-empty"><Users /><p>{text}</p></div>; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TK"; }
function approvalLabel(status: ApprovalStatus, language: "sr" | "en") { return ({ pending: language === "sr" ? "Čeka" : "Pending", approved: language === "sr" ? "Odobren" : "Approved", rejected: language === "sr" ? "Odbijen" : "Rejected" })[status]; }
