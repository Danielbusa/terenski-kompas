"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-location-assign-relative-destination, react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, BarChart3, CheckCircle2, ClipboardList, CloudOff, Compass, LoaderCircle, LocateFixed, LogOut, Map, MapPin, Navigation, PanelLeftClose, PanelLeftOpen, Plus, Radio, Receipt, RefreshCw, Search, Settings, ShieldCheck, Signal, Trophy, UserRound, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth-gate";
import { AddressCoordinatePicker } from "@/components/address-coordinate-picker";
import { LanguageToggle, useLanguage } from "@/components/language-provider";
import { LiveFieldMap, type FieldTask, type TourStop, type VisitMarker } from "@/components/live-field-map";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { EmptyState, PageHeading, SectionCard, StatCard as Metric, StatusBadge } from "@/components/ui/dashboard";
import { cacheData, enqueue, flushQueue, readCachedData, readQueue } from "@/lib/offline-queue";
import { getSupabase } from "@/lib/supabase/client";

declare global {
  interface Document {
    modelContext?: {
      registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => unknown;
    };
  }
}

type Workspace = "field" | "watcher" | "leaderboard" | "finder" | "expenses" | "help";
type ApprovalStatus = "pending" | "approved" | "rejected";
type UserRole = "admin" | "coordinator" | "canvasser" | "poll_watcher";

type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  approval_status: ApprovalStatus;
  assigned_region: string | null;
  faculty: string | null;
};

type Incident = {
  id: string;
  polling_station_number: string;
  municipality: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "critical";
  status: "pending_review" | "verified" | "dismissed" | "escalated_to_legal";
  created_at: string;
};

type Expense = {
  id: string;
  origin: string;
  destination: string;
  travel_date: string;
  transport_type: string;
  amount_rsd: number;
  receipt_path: string | null;
  status: "pending_review" | "approved" | "rejected" | "paid";
  admin_note: string | null;
  created_at: string;
};

type LeaderboardRow = {
  faculty: string;
  completed_visits: number;
  active_volunteers: number;
  follow_ups: number;
};

type PollingStation = {
  id: string;
  station_number: string;
  municipality: string;
  address: string;
  latitude: number;
  longitude: number;
  coordinator_name: string | null;
  coordinator_phone: string | null;
  notes: string | null;
};

type ActivityLog = {
  id: string;
  action: string;
  entity_type: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type DashboardData = {
  tasks: FieldTask[];
  visits: VisitMarker[];
  incidents: Incident[];
  expenses: Expense[];
  leaderboard: LeaderboardRow[];
  activity: ActivityLog[];
  tourStops: TourStop[];
  documents: {id:string;title_sr:string;title_en:string;content_sr:string;content_en:string;category:string}[];
};

const emptyData: DashboardData = { tasks: [], visits: [], incidents: [], expenses: [], leaderboard: [], activity: [],tourStops:[],documents:[] };

export default function HomePage() {
  return <AuthGate><OperationsDashboard /></AuthGate>;
}

function OperationsDashboard() {
  const { t, language } = useLanguage();
  const [workspace, setWorkspace] = useState<Workspace>("field");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [pending, setPending] = useState(0);
  const [visitTask, setVisitTask] = useState<FieldTask | null | undefined>(undefined);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);

  const loadData = useCallback(async (quiet = false) => {
    if (typeof window === "undefined") return;
    const supabase = getSupabase();
    if (!supabase) return;
    if (!quiet) setRefreshing(true);
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user.id;
    if (!userId) return;

    if (!navigator.onLine) {
      const cached = await readCachedData<DashboardData>(`dashboard:${userId}`);
      if (cached) setData(cached);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [profileResult, tasksResult, visitsResult, incidentsResult, expensesResult, leaderboardResult, activityResult,tourResult,docsResult] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,role,approval_status,assigned_region,faculty").eq("id", userId).single(),
      supabase.from("field_tasks").select("id,title,address,city_village,latitude,longitude,status,notes,due_date").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("visits").select("id,latitude,longitude,address,status,completed_at").order("completed_at", { ascending: false }).limit(250),
      supabase.from("incidents").select("id,polling_station_number,municipality,title,description,severity,status,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("travel_expenses").select("id,origin,destination,travel_date,transport_type,amount_rsd,receipt_path,status,admin_note,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.rpc("get_faculty_leaderboard"),
      supabase.from("activity_logs").select("id,action,entity_type,metadata,created_at").order("created_at", { ascending: false }).limit(25),
      supabase.from("tour_stops").select("id,date,municipality,location_name,status,latitude,longitude").order("date",{ascending:false}).limit(500),
      supabase.from("field_documents").select("id,title_sr,title_en,content_sr,content_en,category").order("display_order"),
    ]);

    const firstError = [profileResult, tasksResult, visitsResult, incidentsResult, expensesResult, leaderboardResult, activityResult,tourResult,docsResult].find((result) => result.error)?.error;
    if (firstError) toast.error(t("Podaci nisu potpuno učitani.", "Some data could not be loaded."), { description: firstError.message });
    if (profileResult.data) setProfile(profileResult.data as Profile);
    const next: DashboardData = {
      tasks: (tasksResult.data ?? []) as FieldTask[],
      visits: (visitsResult.data ?? []) as VisitMarker[],
      incidents: (incidentsResult.data ?? []) as Incident[],
      expenses: (expensesResult.data ?? []).map((item) => ({ ...item, amount_rsd: Number(item.amount_rsd) })) as Expense[],
      leaderboard: (leaderboardResult.data ?? []).map((item: LeaderboardRow) => ({ ...item, completed_visits: Number(item.completed_visits), active_volunteers: Number(item.active_volunteers), follow_ups: Number(item.follow_ups) })),
      activity: (activityResult.data ?? []) as ActivityLog[],
      tourStops:(tourResult.data??[]) as TourStop[],documents:(docsResult.data??[]) as DashboardData["documents"],
    };
    setData(next);
    await cacheData(`dashboard:${userId}`, next);
    setPending((await readQueue()).length);
    setLoading(false);
    setRefreshing(false);
  }, [t]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const initialLoad = window.setTimeout(() => void loadData(true), 0);
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase.channel("operations-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "field_tasks" }, () => void loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "visits" }, () => void loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents" }, () => void loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "travel_expenses" }, () => void loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "tour_stops" }, () => void loadData(true))
      .subscribe();
    const handleOnline = async () => {
      setOnline(true);
      const result = await flushQueue();
      if (result.synced) toast.success(t(`${result.synced} unosa je sinhronizovano.`, `${result.synced} entries synced.`));
      await loadData(true);
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    return () => {
      window.clearTimeout(initialLoad);
      void supabase.removeChannel(channel);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadData, t]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "open_operations_workspace",
      title: t("Otvori radni prostor", "Open operations workspace"),
      description: "Open a Terenski Kompas operational workspace without changing data.",
      inputSchema: { type: "object", properties: { workspace: { type: "string", enum: ["field", "watcher", "leaderboard", "finder", "expenses", "admin"] } }, required: ["workspace"], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input: unknown) {
        const value = (input as { workspace?: string }).workspace;
        if (value === "admin") { window.location.href = "/admin"; return { status: "opening_admin" }; }
        if (!["field", "watcher", "leaderboard", "finder", "expenses"].includes(value ?? "")) throw new Error("Invalid workspace");
        setWorkspace(value as Workspace);
        return { status: "visible", workspace: value };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [t]);

  useEffect(() => {
    if (!profile) return;
    const allowed = roleWorkspaces(profile.role);
    if (!allowed.includes(workspace)) setWorkspace(allowed[0]);
  }, [profile, workspace]);

  const signOut = async () => {
    await getSupabase()?.auth.signOut();
    if (typeof window !== "undefined") window.location.href = "/login";
  };

  const syncNow = async () => {
    if (typeof navigator === "undefined" || !navigator.onLine) return toast.error(t("Nema internet veze.", "No internet connection."));
    setRefreshing(true);
    const result = await flushQueue();
    await loadData(true);
    toast.success(t(`Sinhronizovano: ${result.synced}.`, `Synced: ${result.synced}.`));
  };

  if (loading || !profile) return <main className="setup-screen"><LoaderCircle className="spin" /><p>{t("Učitavamo terenske podatke…", "Loading field operations…")}</p></main>;

  const firstName = profile.full_name.trim().split(/\s+/)[0] || profile.full_name;
  const visibleNav = navItems(t).filter((item) => roleWorkspaces(profile.role).includes(item.id));
  return <div className={`ops-shell ${railCollapsed ? "rail-collapsed" : ""}`}>
    <aside className="ops-rail">
      <button type="button" className="rail-collapse" onClick={() => setRailCollapsed((value) => !value)} aria-label={railCollapsed ? t("Proširi navigaciju", "Expand navigation") : t("Skupi navigaciju", "Collapse navigation")}>{railCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button>
      <span className="brand-mark"><Compass /></span>
      <nav aria-label={t("Glavna navigacija", "Main navigation")}>{visibleNav.map((item) => <button type="button" key={item.id} className={workspace === item.id ? "active" : ""} onClick={() => setWorkspace(item.id)} title={item.label}>{item.icon}</button>)}{["admin","coordinator"].includes(profile.role) && <a href="/admin" title={t("Centrala", "Admin center")}><BarChart3 /></a>}<a href="/profile" title={t("Profil i podešavanja", "Profile & settings")}><Settings /></a></nav>
      <div className="rail-account"><a className="profile-avatar-button" href="/profile">{initials(profile.full_name)}</a><button type="button" className="rail-logout" onClick={signOut} title={t("Odjavi se", "Log out")}><LogOut /></button></div>
    </aside>
    <main className="ops-main">
      <header className="ops-header">
        <div className="ops-brand"><span className="brand-mark"><Compass /></span><div><b>Terenski Kompas</b><small>{roleLabel(profile.role, language)} · {profile.assigned_region || t("Region nije dodeljen", "Region not assigned")}</small></div></div>
        <nav className="ops-tabs" aria-label={t("Radni prostori", "Workspaces")}>{visibleNav.map((item) => <button type="button" key={item.id} className={workspace === item.id ? "active" : ""} onClick={() => setWorkspace(item.id)}>{item.label}</button>)}</nav>
        <div className="ops-actions"><label className="top-search"><Search /><input type="search" aria-label={t("Pretraži kontrolnu tablu", "Search dashboard")} placeholder={t("Pretraga", "Search")} /></label><LanguageToggle compact /><button type="button" className="top-icon-button" onClick={() => void loadData()} disabled={refreshing} aria-label={t("Osveži", "Refresh")}><RefreshCw className={refreshing ? "spin" : ""} /></button><button type="button" className={online ? "network-state online" : "network-state offline"} onClick={() => void syncNow()}>{online ? <Signal /> : <CloudOff />}{online ? t("Na mreži", "Online") : t("Selo režim", "Village mode")}{pending > 0 && <b>{pending}</b>}</button><a className="top-profile" href="/profile" aria-label={t("Profil i podešavanja", "Profile and settings")}><span>{initials(profile.full_name)}</span><UserRound /></a></div>
      </header>
      <div className="ops-content">
        <PageHeading className="ops-welcome" eyebrow={workspaceEyebrow(workspace, t)} title={t(`Zdravo, ${firstName}.`, `Hello, ${firstName}.`)} description={workspaceDescription(workspace, t)} />
        {workspace === "field" && <FieldWorkspace data={data} pending={pending} onVisit={(task) => setVisitTask(task)} />}
        {workspace === "watcher" && <WatcherWorkspace incidents={data.incidents} onReport={() => setIncidentOpen(true)} />}
        {workspace === "leaderboard" && <LeaderboardWorkspace rows={data.leaderboard} />}
        {workspace === "finder" && <PollingStationFinder />}
        {workspace === "expenses" && <ExpensesWorkspace profile={profile} expenses={data.expenses} onSaved={() => void loadData(true)} />}
        {workspace === "help" && <HelpWorkspace documents={data.documents}/>} 
      </div>
      <nav className="ops-mobile-nav">{visibleNav.slice(0, 4).map((item) => <button type="button" key={item.id} className={workspace === item.id ? "active" : ""} onClick={() => setWorkspace(item.id)}>{item.icon}<span>{item.short}</span></button>)}<a href="/profile"><Settings /><span>{t("Profil", "Profile")}</span></a></nav>
    </main>
    <VisitDialog open={visitTask !== undefined} task={visitTask ?? null} profile={profile} onClose={() => setVisitTask(undefined)} onSaved={() => void loadData(true)} />
    <IncidentDialog open={incidentOpen} profile={profile} onClose={() => setIncidentOpen(false)} onSaved={() => void loadData(true)} />
    <Toaster richColors position="top-center" />
  </div>;
}

function FieldWorkspace({ data, pending, onVisit }: { data: DashboardData; pending: number; onVisit: (task: FieldTask | null) => void }) {
  const { t, language } = useLanguage();
  const openTasks = data.tasks.filter((task) => task.status === "assigned" || task.status === "in_progress");
  const completedToday = data.visits.filter((visit) => isToday(visit.completed_at)).length;
  return <div className="workspace-stack">
    <section className="metric-row"><Metric icon={<ClipboardList />} label={t("Dodeljeni zadaci", "Assigned tasks")} value={openTasks.length} trend={t("Otvoreno", "Open")} tone="neutral" /><Metric icon={<CheckCircle2 />} label={t("Posete danas", "Visits today")} value={completedToday} trend={t("Danas", "Today")} tone="success" /><Metric icon={<MapPin />} label={t("Ukupno poseta", "Total visits")} value={data.visits.length} trend={t("Sve posete", "All visits")} tone="neutral" /><Metric icon={<WifiOff />} label={t("Čeka sinhronizaciju", "Queued offline")} value={pending} trend={pending ? t("Na čekanju", "Pending") : t("Sinhronizovano", "Synced")} tone={pending ? "warning" : "success"} /></section>
    <SectionCard className="tour-panel" eyebrow={t("TURNEJA","TOUR SCHEDULE")} title={t("Sledeće stanice i akcije","Upcoming stops and actions")} icon={<Navigation />}>{data.tourStops.length===0?<EmptyState icon={<MapPin/>} title={t("Nema zakazanih stanica","No scheduled stops")} text={t("Koordinator će ovde objaviti sledeću rutu.","Your coordinator will publish the next route here.")}/>:<div className="tour-stop-list">{data.tourStops.map(stop=><article key={stop.id}><time>{new Intl.DateTimeFormat(language==="sr"?"sr-RS":"en-GB",{day:"2-digit",month:"short"}).format(new Date(`${stop.date}T12:00:00`))}</time><div><b>{stop.location_name}</b><p>{stop.municipality}</p></div><StatusBadge tone={stop.status === "completed" ? "success" : stop.status === "cancelled" ? "danger" : "warning"}>{stop.status.replaceAll("_"," ")}</StatusBadge></article>)}</div>}</SectionCard>
    <div className="field-layout"><LiveFieldMap tasks={data.tasks} visits={data.visits} tourStops={data.tourStops} onSelectTask={onVisit} /><SectionCard className="task-list-panel" eyebrow={t("MOJI ZADACI", "MY TASKS")} title={t("Sledeće adrese", "Next addresses")} action={<Button size="sm" onClick={() => onVisit(null)}><Plus /> {t("Poseta", "Visit")}</Button>}>{openTasks.length === 0 ? <EmptyState icon={<ClipboardList />} title={t("Nema otvorenih zadataka", "No open tasks")} text={t("Koordinator još nije dodelio nove adrese.", "Your coordinator has not assigned new addresses yet.")} /> : <div className="task-list">{openTasks.map((task) => <article key={task.id}><span className={`task-state ${task.status}`} /><div><b>{task.title}</b><p>{task.address}, {task.city_village}</p><small>{task.due_date ? new Intl.DateTimeFormat(language === "sr" ? "sr-RS" : "en-GB", { dateStyle: "medium" }).format(new Date(`${task.due_date}T12:00:00`)) : t("Bez roka", "No due date")}</small></div><button type="button" onClick={() => onVisit(task)}><ArrowRight /></button></article>)}</div>}</SectionCard></div>
    <SectionCard className="activity-panel" eyebrow={t("AKTIVNOST", "ACTIVITY")} title={t("Nedavne terenske promene", "Recent field updates")}>{data.activity.length === 0 ? <EmptyState icon={<RefreshCw />} title={t("Nema aktivnosti", "No activity yet")} text={t("Sinhronizovane posete i prijave pojaviće se ovde.", "Synced visits and reports will appear here.")} /> : <div className="activity-list">{data.activity.map((entry) => <article key={entry.id}><RefreshCw /><div><b>{activityLabel(entry.action, t)}</b><small>{new Intl.DateTimeFormat(language === "sr" ? "sr-RS" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.created_at))}</small></div></article>)}</div>}</SectionCard>
  </div>;
}

function activityLabel(action: string, t: (sr: string, en: string) => string) {
  return ({ visit_completed: t("Poseta je evidentirana", "Visit recorded"), incident_reported: t("Incident je prijavljen", "Incident reported"), expense_submitted: t("Trošak je poslat", "Expense submitted") } as Record<string, string>)[action] ?? action.replaceAll("_", " ");
}

function WatcherWorkspace({ incidents, onReport }: { incidents: Incident[]; onReport: () => void }) {
  const { t, language } = useLanguage();
  const critical = incidents.filter((incident) => incident.severity === "critical" && !["dismissed", "verified"].includes(incident.status)).length;
  const pending = incidents.filter((incident) => incident.status === "pending_review").length;
  return <div className="workspace-stack"><section className="metric-row"><Metric icon={<AlertTriangle />} label={t("Otvorene prijave", "Open reports")} value={pending} /><Metric icon={<Radio />} label={t("Kritične", "Critical")} value={critical} /><Metric icon={<ShieldCheck />} label={t("Ukupno prijava", "Total reports")} value={incidents.length} /></section><section className="data-panel"><div className="panel-heading"><div><p className="eyebrow">{t("IZBORNI DAN", "ELECTION DAY")}</p><h2>{t("Prijave incidenata", "Incident reports")}</h2></div><Button className="danger-btn" onClick={onReport}><AlertTriangle /> {t("Prijavi incident", "Report incident")}</Button></div>{incidents.length === 0 ? <EmptyState icon={<ShieldCheck />} title={t("Nema prijavljenih incidenata", "No incidents reported")} text={t("Nove prijave će se pojaviti ovde u realnom vremenu.", "New reports will appear here in real time.")} /> : <div className="incident-table">{incidents.map((incident) => <article key={incident.id}><span className={`severity-dot ${incident.severity}`} /><div><small>{incident.polling_station_number} · {incident.municipality}</small><h3>{incident.title}</h3><p>{incident.description}</p></div><div><span className={`status-pill ${incident.status}`}>{incidentStatus(incident.status, language)}</span><small>{new Intl.DateTimeFormat(language === "sr" ? "sr-RS" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(incident.created_at))}</small></div></article>)}</div>}</section></div>;
}

function LeaderboardWorkspace({ rows }: { rows: LeaderboardRow[] }) {
  const { t } = useLanguage();
  return <section className="data-panel leaderboard-panel"><div className="panel-heading"><div><p className="eyebrow">{t("FAKULTETSKA TABELA", "FACULTY LEADERBOARD")}</p><h2>{t("Terenski učinak po fakultetima", "Field performance by faculty")}</h2><p>{t("Rangiranje se automatski računa iz stvarno završenih poseta.", "Rankings are calculated automatically from completed visits.")}</p></div><Trophy /></div>{rows.length === 0 ? <EmptyState icon={<Trophy />} title={t("Još nema rezultata", "No results yet")} text={t("Tabela će se popuniti nakon prvih evidentiranih poseta i dodeljenih fakulteta.", "The board will populate after visits are recorded and faculties are assigned.")} /> : <div className="leaderboard-list">{rows.map((row, index) => <article key={row.faculty}><span className={`leader-rank rank-${index + 1}`}>{index + 1}</span><div><h3>{row.faculty}</h3><p>{row.active_volunteers} {t("aktivnih volontera", "active volunteers")} · {row.follow_ups} {t("praćenja", "follow-ups")}</p></div><strong>{row.completed_visits}<small>{t("poseta", "visits")}</small></strong></article>)}</div>}</section>;
}

function PollingStationFinder() {
  const { t } = useLanguage();
  const [results, setResults] = useState<PollingStation[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("address") ?? "").trim();
    if (!query) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("find_polling_stations", { search_text: query });
    if (error) toast.error(t("Pretraga nije uspela.", "Search failed."), { description: error.message });
    setResults((data ?? []) as PollingStation[]);
    setSearched(true);
    setLoading(false);
  };
  return <section className="finder-layout"><div className="finder-card"><p className="eyebrow">{t("PRONALAZAČ BIRAČKOG MESTA", "POLLING STATION FINDER")}</p><h2>{t("Pronađi biračko mesto", "Find a polling station")}</h2><p>{t("Unesi ulicu, opštinu ili broj biračkog mesta.", "Enter a street, municipality, or station number.")}</p><form onSubmit={search}><Search /><Input name="address" aria-label={t("Adresa ili broj biračkog mesta", "Address or polling station number")} placeholder={t("Na primer: Bulevar oslobođenja, Novi Sad", "For example: Bulevar oslobođenja, Novi Sad")} required /><Button type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <LocateFixed />} {t("Pronađi", "Find")}</Button></form><small>{t("Rezultati dolaze iz verifikovanog registra biračkih mesta u Supabase bazi.", "Results come from the verified polling-station registry in Supabase.")}</small></div><div className="finder-results">{!searched ? <EmptyState icon={<MapPin />} title={t("Spremno za pretragu", "Ready to search")} text={t("Podaci o smeru i koordinatoru prikazuju se odmah nakon pretrage.", "Directions and coordinator details appear after searching.")} /> : results.length === 0 ? <EmptyState icon={<Search />} title={t("Nema poklapanja", "No match found")} text={t("Proveri adresu ili se obrati koordinatoru da dopuni registar.", "Check the address or ask an administrator to update the registry.")} /> : results.map((station) => <article className="station-result" key={station.id}><div><span>{station.municipality}</span><h3>{station.station_number}</h3><p>{station.address}</p></div><dl><div><dt>{t("Koordinator", "Coordinator")}</dt><dd>{station.coordinator_name || t("Nije dodeljen", "Not assigned")}</dd></div><div><dt>{t("Telefon", "Phone")}</dt><dd>{station.coordinator_phone ? <a href={`tel:${station.coordinator_phone}`}>{station.coordinator_phone}</a> : t("Nije unet", "Not entered")}</dd></div></dl><a className="route-link" href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${station.latitude},${station.longitude}`} target="_blank" rel="noreferrer"><Navigation /> {t("Otvori smer", "Open directions")}</a></article>)}</div></section>;
}

function ExpensesWorkspace({ profile, expenses, onSaved }: { profile: Profile; expenses: Expense[]; onSaved: () => void }) {
  const { t, language } = useLanguage();
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("receipt");
    const id = crypto.randomUUID();
    const path = file instanceof File && file.size ? `${profile.id}/${id}-${safeFileName(file.name)}` : null;
    const payload: Record<string, unknown> = { id, user_id: profile.id, origin: String(form.get("origin") ?? "").trim(), destination: String(form.get("destination") ?? "").trim(), travel_date: String(form.get("travel_date") ?? ""), transport_type: String(form.get("transport_type") ?? "bus"), amount_rsd: Number(form.get("amount_rsd")), notes: String(form.get("notes") ?? "").trim() || null, receipt_path: path, status: "pending_review" };
    setBusy(true);
    const supabase = getSupabase();
    if (!supabase || typeof navigator === "undefined" || !navigator.onLine) {
      await enqueue("travel_expenses", { ...payload, receipt_path: null }, path && file instanceof File ? { bucket: "expense-receipts", path, field: "receipt_path", file } : undefined);
      await enqueue("activity_logs", { id: crypto.randomUUID(), user_id: profile.id, action: "expense_submitted", entity_type: "travel_expense", entity_id: id, metadata: {} });
      toast.success(t("Trošak je sačuvan i čeka sinhronizaciju.", "Expense saved and queued for sync."));
      formElement.reset(); setBusy(false); onSaved(); return;
    }
    if (path && file instanceof File) {
      const upload = await supabase.storage.from("expense-receipts").upload(path, file);
      if (upload.error) { toast.error(t("Račun nije otpremljen.", "Receipt upload failed."), { description: upload.error.message }); setBusy(false); return; }
    }
    const { error } = await supabase.from("travel_expenses").insert(payload);
    if (error) toast.error(t("Trošak nije poslat.", "Expense was not submitted."), { description: error.message });
    else { await supabase.from("activity_logs").insert({ user_id: profile.id, action: "expense_submitted", entity_type: "travel_expense", entity_id: id, metadata: {} }); toast.success(t("Putni trošak je poslat na pregled.", "Travel expense submitted for review.")); formElement.reset(); onSaved(); }
    setBusy(false);
  };
  return <div className="expense-layout"><section className="data-panel expense-form-panel"><div className="panel-heading"><div><p className="eyebrow">{t("PUTNI TROŠKOVI", "TRAVEL EXPENSES")}</p><h2>{t("Nova prijava", "New claim")}</h2></div><Receipt /></div><form className="expense-form" onSubmit={submit}><div><Label htmlFor="origin">{t("Polazak", "Origin")}</Label><Input id="origin" name="origin" required /></div><div><Label htmlFor="destination">{t("Odredište", "Destination")}</Label><Input id="destination" name="destination" required /></div><div><Label htmlFor="travel_date">{t("Datum puta", "Travel date")}</Label><Input id="travel_date" name="travel_date" type="date" required /></div><div><Label>{t("Prevoz", "Transport")}</Label><Select name="transport_type" defaultValue="bus"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bus">{t("Autobus", "Bus")}</SelectItem><SelectItem value="train">{t("Voz", "Train")}</SelectItem><SelectItem value="car">{t("Automobil", "Car")}</SelectItem><SelectItem value="other">{t("Drugo", "Other")}</SelectItem></SelectContent></Select></div><div><Label htmlFor="amount_rsd">{t("Iznos RSD", "Amount RSD")}</Label><Input id="amount_rsd" name="amount_rsd" type="number" min="1" step="0.01" required /></div><div><Label htmlFor="receipt">{t("Karta ili račun", "Ticket or receipt")}</Label><Input id="receipt" name="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" /></div><div className="form-wide"><Label htmlFor="expense_notes">{t("Napomena", "Notes")}</Label><Textarea id="expense_notes" name="notes" /></div><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Receipt />} {t("Pošalji na pregled", "Submit for review")}</Button></form></section><section className="data-panel"><div className="panel-heading"><div><p className="eyebrow">{t("MOJE PRIJAVE", "MY CLAIMS")}</p><h2>{t("Status refundacija", "Reimbursement status")}</h2></div></div>{expenses.length === 0 ? <EmptyState icon={<Receipt />} title={t("Nema prijavljenih troškova", "No expense claims")} text={t("Nove prijave i status pregleda pojaviće se ovde.", "New claims and review status will appear here.")} /> : <div className="expense-list">{expenses.map((expense) => <article key={expense.id}><div><b>{expense.origin} → {expense.destination}</b><p>{new Intl.DateTimeFormat(language === "sr" ? "sr-RS" : "en-GB", { dateStyle: "medium" }).format(new Date(`${expense.travel_date}T12:00:00`))} · {expense.transport_type}</p>{expense.admin_note && <small>{expense.admin_note}</small>}</div><strong>{expense.amount_rsd.toLocaleString(language === "sr" ? "sr-RS" : "en-GB")} RSD<span className={`status-pill ${expense.status}`}>{expenseStatus(expense.status, language)}</span></strong></article>)}</div>}</section></div>;
}

function VisitDialog({ open, task, profile, onClose, onSaved }: { open: boolean; task: FieldTask | null; profile: Profile; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = crypto.randomUUID();
    const latitude=Number(form.get("latitude")),longitude=Number(form.get("longitude"));
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!String(form.get("latitude")??"")||!String(form.get("longitude")??"")){toast.error(t("Izaberite adresu ili upotrebite GPS lokaciju.","Select an address or use your GPS location."));return}
    const payload = { id, canvasser_id: profile.id, task_id: task?.id ?? null, latitude, longitude, address: String(form.get("address") ?? "").trim() || null, city_village: String(form.get("city_village") ?? "").trim() || profile.assigned_region || "Srbija", status: String(form.get("status") ?? "visited_neutral"), notes: String(form.get("notes") ?? "").trim() || null, follow_up_requested: form.get("follow_up") === "yes", completed_at: new Date().toISOString() };
    setBusy(true);
    const supabase = getSupabase();
    if (!supabase || typeof navigator === "undefined" || !navigator.onLine) {
      await enqueue("visits", payload);
      await enqueue("activity_logs", { id: crypto.randomUUID(), user_id: profile.id, action: "visit_completed", entity_type: "visit", entity_id: id, metadata: { task_id: task?.id ?? null } });
      toast.success(t("Poseta je sačuvana u Selo režimu.", "Visit saved in Village mode."));
      setBusy(false); onClose(); onSaved(); return;
    }
    const { error } = await supabase.from("visits").insert(payload);
    if (error) toast.error(t("Poseta nije sačuvana.", "Visit was not saved."), { description: error.message });
    else {
      if (task) await supabase.from("field_tasks").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", task.id);
      await supabase.from("activity_logs").insert({ user_id: profile.id, action: "visit_completed", entity_type: "visit", entity_id: id, metadata: { task_id: task?.id ?? null } });
      toast.success(t("Poseta je sinhronizovana.", "Visit synced.")); onClose(); onSaved();
    }
    setBusy(false);
  };
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="entry-dialog"><form onSubmit={submit} className="dialog-form"><DialogHeader><DialogTitle>{t("Zabeleži posetu", "Log a visit")}</DialogTitle><DialogDescription>{task ? `${task.title} · ${task.address}` : t("Pretražite adresu ili upotrebite GPS lokaciju.", "Search for an address or use your GPS location.")}</DialogDescription></DialogHeader><div className="form-grid"><AddressCoordinatePicker address={task?.address??""} locality={task?.city_village??profile.assigned_region??""} latitude={task?.latitude??null} longitude={task?.longitude??null}/><div><Label htmlFor="visit-outcome">{t("Ishod", "Outcome")}</Label><select id="visit-outcome" name="status" className="native-field-select" defaultValue="visited_neutral"><option value="visited_supporter">{t("Podržava", "Supporter")}</option><option value="visited_neutral">{t("Neodlučan", "Neutral")}</option><option value="visited_hostile">{t("Protiv", "Hostile")}</option><option value="not_home">{t("Nije kod kuće", "Not home")}</option><option value="refused">{t("Odbio razgovor", "Refused")}</option></select></div><div><Label htmlFor="visit-follow-up">{t("Praćenje", "Follow-up")}</Label><select id="visit-follow-up" name="follow_up" className="native-field-select" defaultValue="no"><option value="no">{t("Nije potrebno", "Not needed")}</option><option value="yes">{t("Potrebno", "Required")}</option></select></div><div className="form-wide"><Label>{t("Beleška", "Notes")}</Label><Textarea name="notes" /></div></div><DialogFooter><Button type="button" variant="outline" onClick={onClose}>{t("Otkaži", "Cancel")}</Button><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <CheckCircle2 />} {t("Sačuvaj posetu", "Save visit")}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function IncidentDialog({ open, profile, onClose, onSaved }: { open: boolean; profile: Profile; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = crypto.randomUUID();
    const file = form.get("media");
    const path = file instanceof File && file.size ? `${profile.id}/${id}-${safeFileName(file.name)}` : null;
    const position = await currentPosition();
    const payload: Record<string, unknown> = { id, reporter_id: profile.id, polling_station_number: String(form.get("polling_station_number") ?? "").trim(), municipality: String(form.get("municipality") ?? "").trim(), title: String(form.get("title") ?? "").trim(), description: String(form.get("description") ?? "").trim(), severity: String(form.get("severity") ?? "medium"), status: "pending_review", media_urls: [], latitude: position?.latitude ?? null, longitude: position?.longitude ?? null };
    setBusy(true);
    const supabase = getSupabase();
    if (!supabase || typeof navigator === "undefined" || !navigator.onLine) {
      await enqueue("incidents", payload, path && file instanceof File ? { bucket: "incident-media", path, field: "media_urls", file } : undefined);
      await enqueue("activity_logs", { id: crypto.randomUUID(), user_id: profile.id, action: "incident_reported", entity_type: "incident", entity_id: id, metadata: { severity: payload.severity } });
      toast.success(t("Prijava je sačuvana i čeka mrežu.", "Report saved and waiting for a connection."));
      setBusy(false); onClose(); onSaved(); return;
    }
    if (path && file instanceof File) {
      const upload = await supabase.storage.from("incident-media").upload(path, file);
      if (upload.error) { toast.error(t("Prilog nije otpremljen.", "Attachment upload failed."), { description: upload.error.message }); setBusy(false); return; }
      payload.media_urls = [path];
    }
    const { error } = await supabase.from("incidents").insert(payload);
    if (error) toast.error(t("Incident nije prijavljen.", "Incident was not submitted."), { description: error.message });
    else { await supabase.from("activity_logs").insert({ user_id: profile.id, action: "incident_reported", entity_type: "incident", entity_id: id, metadata: { severity: payload.severity } }); toast.success(t("Incident je poslat na proveru.", "Incident submitted for review.")); onClose(); onSaved(); }
    setBusy(false);
  };
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="entry-dialog"><form onSubmit={submit} className="dialog-form"><DialogHeader><DialogTitle>{t("Prijavi incident", "Report an incident")}</DialogTitle><DialogDescription>{t("Vreme i lokacija se dodaju automatski kada su dostupni.", "Time and location are added automatically when available.")}</DialogDescription></DialogHeader><div className="form-grid"><div><Label>{t("Biračko mesto", "Polling station")}</Label><Input name="polling_station_number" required /></div><div><Label>{t("Opština", "Municipality")}</Label><Input name="municipality" required /></div><div><Label>{t("Ozbiljnost", "Severity")}</Label><Select name="severity" defaultValue="medium"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">{t("Niska", "Low")}</SelectItem><SelectItem value="medium">{t("Srednja", "Medium")}</SelectItem><SelectItem value="critical">{t("Kritična", "Critical")}</SelectItem></SelectContent></Select></div><div><Label>{t("Foto ili video", "Photo or video")}</Label><Input name="media" type="file" accept="image/*,video/mp4,video/quicktime" /></div><div className="form-wide"><Label>{t("Naslov", "Title")}</Label><Input name="title" required /></div><div className="form-wide"><Label>{t("Opis", "Description")}</Label><Textarea name="description" required /></div></div><DialogFooter><Button type="button" variant="outline" onClick={onClose}>{t("Otkaži", "Cancel")}</Button><Button type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <AlertTriangle />} {t("Pošalji prijavu", "Submit report")}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function HelpWorkspace({documents}:{documents:DashboardData["documents"]}){const{t,language}=useLanguage();return <div className="help-layout"><section className="data-panel"><div className="panel-heading"><div><p className="eyebrow">{t("POMOĆ I PODRŠKA","HELP & SUPPORT")}</p><h2>{t("Smernice za bezbedan terenski rad","Safe field-work guidelines")}</h2></div><ShieldCheck/></div><div className="guideline-list">{documents.map(doc=><article key={doc.id}><span><ShieldCheck/></span><div><small>{doc.category}</small><h3>{language==="sr"?doc.title_sr:doc.title_en}</h3><p>{language==="sr"?doc.content_sr:doc.content_en}</p></div></article>)}</div></section><aside className="support-card"><h3>{t("Potrebna je pomoć?","Need help?")}</h3><p>{t("U hitnom slučaju pozovite 112. Za operativna pitanja obratite se svom regionalnom koordinatoru.","Call 112 in an emergency. Contact your regional coordinator for operational questions.")}</p></aside></div>}

function navItems(t: (sr: string, en: string) => string): Array<{ id: Workspace; label: string; short: string; icon: ReactNode }> {
  return [
    { id: "field", label: t("Teren", "Field"), short: t("Teren", "Field"), icon: <Map /> },
    { id: "watcher", label: t("Kontrolor", "Watcher"), short: t("Kontrola", "Watch"), icon: <ShieldCheck /> },
    { id: "leaderboard", label: t("Fakulteti", "Faculties"), short: t("Tabela", "Board"), icon: <Trophy /> },
    { id: "finder", label: t("Biračko mesto", "Polling station"), short: t("Pronađi", "Find"), icon: <Search /> },
    { id: "expenses", label: t("Troškovi", "Expenses"), short: t("Troškovi", "Costs"), icon: <Receipt /> },
    { id: "help", label: t("Pomoć", "Help"), short: t("Pomoć", "Help"), icon: <ShieldCheck /> },
  ];
}

function roleWorkspaces(role: UserRole): Workspace[] {
  if (role === "canvasser") return ["field", "leaderboard", "finder", "expenses","help"];
  if (role === "poll_watcher") return ["watcher", "finder", "expenses","help"];
  return ["field", "watcher", "leaderboard", "finder", "expenses","help"];
}

function workspaceEyebrow(workspace: Workspace, t: (sr: string, en: string) => string) {
  return ({ field: t("TERENSKI RAD", "FIELD OPERATIONS"), watcher: t("IZBORNI NADZOR", "ELECTION MONITORING"), leaderboard: t("GAMIFIKACIJA", "GAMIFICATION"), finder: t("BRZA PRETRAGA", "INSTANT LOOKUP"), expenses: t("REFUNDACIJE", "REIMBURSEMENTS"),help:t("POMOĆ I PODRŠKA","HELP & SUPPORT") })[workspace];
}

function workspaceDescription(workspace: Workspace, t: (sr: string, en: string) => string) {
  return ({ field: t("Dodeljene adrese, mapa i evidencija obilaska.", "Assigned addresses, map, and visit logging."), watcher: t("Prijave i status incidenata sa biračkih mesta.", "Polling-station incident reports and statuses."), leaderboard: t("Učinak fakultetskih timova iz stvarnih terenskih podataka.", "Faculty team performance from live field data."), finder: t("Pronađi verifikovano biračko mesto i lokalnog koordinatora.", "Find a verified polling station and local coordinator."), expenses: t("Prijavi kartu ili putni trošak i prati odobrenje.", "Submit travel costs and track approval."),help:t("Proverene smernice, privatnost i bezbednost na terenu.","Verified guidance, privacy, and field safety.") })[workspace];
}

function roleLabel(role: UserRole, language: "sr" | "en") {
  const labels = { admin: ["Administrator", "Administrator"], coordinator: ["Koordinator", "Coordinator"], canvasser: ["Volonter", "Canvasser"], poll_watcher: ["Kontrolor", "Poll watcher"] } as const;
  return labels[role][language === "sr" ? 0 : 1];
}

function incidentStatus(status: Incident["status"], language: "sr" | "en") {
  const labels = { pending_review: ["Čeka proveru", "Pending review"], verified: ["Potvrđen", "Verified"], dismissed: ["Odbačen", "Dismissed"], escalated_to_legal: ["Pravna služba", "Legal review"] } as const;
  return labels[status][language === "sr" ? 0 : 1];
}

function expenseStatus(status: Expense["status"], language: "sr" | "en") {
  const labels = { pending_review: ["Čeka proveru", "Pending review"], approved: ["Odobren", "Approved"], rejected: ["Odbijen", "Rejected"], paid: ["Isplaćen", "Paid"] } as const;
  return labels[status][language === "sr" ? 0 : 1];
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TK";
}

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function safeFileName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function currentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => navigator.geolocation.getCurrentPosition(
    (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
    () => resolve(null),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
  ));
}
