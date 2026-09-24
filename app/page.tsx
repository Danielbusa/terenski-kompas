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
  documents: { id: string; title_sr: string; title_en: string; content_sr: string; content_en: string; category: string }[];
};

const emptyData: DashboardData = { tasks: [], visits: [], incidents: [], expenses: [], leaderboard: [], activity: [], tourStops: [], documents: [] };

export default function HomePage() {
  return (
    <AuthGate>
      <OperationsDashboard />
    </AuthGate>
  );
}

function OperationsDashboard() {
  const { t, language } = useLanguage();
  const [workspace, setWorkspace] = useState<Workspace>("field");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [pending, setPending] = useState(0);
  const [visitTask, setVisitTask] = useState<FieldTask | null | undefined>(undefined);
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);

  const loadData = useCallback(async (quiet = false) => {
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

    const [profileResult, tasksResult, visitsResult, incidentsResult, expensesResult, leaderboardResult, activityResult, tourResult, docsResult] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email,role,approval_status,assigned_region,faculty").eq("id", userId).single(),
      supabase.from("field_tasks").select("id,title,address,city_village,latitude,longitude,status,notes,due_date").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("visits").select("id,latitude,longitude,address,status,completed_at").order("completed_at", { ascending: false }).limit(250),
      supabase.from("incidents").select("id,polling_station_number,municipality,title,description,severity,status,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("travel_expenses").select("id,origin,destination,travel_date,transport_type,amount_rsd,receipt_path,status,admin_note,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.rpc("get_faculty_leaderboard"),
      supabase.from("activity_logs").select("id,action,entity_type,metadata,created_at").order("created_at", { ascending: false }).limit(25),
      supabase.from("tour_stops").select("id,date,municipality,location_name,status,latitude,longitude").order("date", { ascending: false }).limit(500),
      supabase.from("field_documents").select("id,title_sr,title_en,content_sr,content_en,category").order("display_order"),
    ]);

    const firstError = [profileResult, tasksResult, visitsResult, incidentsResult, expensesResult, leaderboardResult, activityResult, tourResult, docsResult].find((result) => result.error)?.error;
    if (firstError) toast.error(t("Podaci nisu potpuno učitani.", "Some data could not be loaded."), { description: firstError.message });
    if (profileResult.data) setProfile(profileResult.data as Profile);
    const next: DashboardData = {
      tasks: (tasksResult.data ?? []) as FieldTask[],
      visits: (visitsResult.data ?? []) as VisitMarker[],
      incidents: (incidentsResult.data ?? []) as Incident[],
      expenses: (expensesResult.data ?? []).map((item) => ({ ...item, amount_rsd: Number(item.amount_rsd) })) as Expense[],
      leaderboard: (leaderboardResult.data ?? []).map((item: LeaderboardRow) => ({ ...item, completed_visits: Number(item.completed_visits), active_volunteers: Number(item.active_volunteers), follow_ups: Number(item.follow_ups) })),
      activity: (activityResult.data ?? []) as ActivityLog[],
      tourStops: (tourResult.data ?? []) as TourStop[],
      documents: (docsResult.data ?? []) as DashboardData["documents"],
    };
    setData(next);
    await cacheData(`dashboard:${userId}`, next);
    setPending((await readQueue()).length);
    setLoading(false);
    setRefreshing(false);
  }, [t]);

  useEffect(() => {
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
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "open_operations_workspace",
      title: t("Otvori radni prostor", "Open operations workspace"),
      description: "Open a Terenski Kompas operational workspace without changing data.",
      inputSchema: { type: "object", properties: { workspace: { type: "string", enum: ["field", "watcher", "leaderboard", "finder", "expenses", "admin"] } }, required: ["workspace"], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
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
    window.location.href = "/login";
  };

  const syncNow = async () => {
    if (!navigator.onLine) return toast.error(t("Nema internet veze.", "No internet connection."));
    setRefreshing(true);
    const result = await flushQueue();
    await loadData(true);
    toast.success(t(`Sinhronizovano: ${result.synced}.`, `Synced: ${result.synced}.`));
  };

  if (loading || !profile) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground gap-3">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("Učitavamo terenske podatke…", "Loading field operations…")}</p>
      </main>
    );
  }

  const firstName = profile.full_name.trim().split(/\s+/)[0] || profile.full_name;
  const visibleNav = navItems(t).filter((item) => roleWorkspaces(profile.role).includes(item.id));

  return (
    <div className="flex min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Sidebar Rail */}
      <aside className={`hidden lg:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 z-30 ${railCollapsed ? "w-16 items-center" : "w-64 p-4"}`}>
        <div className="flex items-center justify-between w-full mb-6 px-1">
          {!railCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Compass className="h-5 w-5" />
              </div>
              <span className="font-bold text-base tracking-tight">Terenski Kompas</span>
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setRailCollapsed((v) => !v)} aria-label={railCollapsed ? t("Proširi navigaciju", "Expand navigation") : t("Skupi navigaciju", "Collapse navigation")}>
            {railCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 space-y-1 w-full" aria-label={t("Glavna navigacija", "Main navigation")}>
          {visibleNav.map((item) => {
            const active = workspace === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setWorkspace(item.id)}
                title={item.label}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                } ${railCollapsed ? "justify-center px-0" : ""}`}
              >
                <span className="shrink-0">{item.icon}</span>
                {!railCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}

          {["admin", "coordinator"].includes(profile.role) && (
            <a
              href="/admin"
              title={t("Centrala", "Admin center")}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${railCollapsed ? "justify-center px-0" : ""}`}
            >
              <BarChart3 className="h-4 w-4 shrink-0" />
              {!railCollapsed && <span>{t("Centrala", "Admin center")}</span>}
            </a>
          )}
          <a
            href="/profile"
            title={t("Profil i podešavanja", "Profile & settings")}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${railCollapsed ? "justify-center px-0" : ""}`}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!railCollapsed && <span>{t("Podešavanja", "Settings")}</span>}
          </a>
        </nav>

        <div className={`mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3 w-full ${railCollapsed ? "flex-col justify-center" : "justify-between"}`}>
          <a href="/profile" className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-xs shrink-0">
              {initials(profile.full_name)}
            </div>
            {!railCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-none truncate">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground truncate mt-1">{roleLabel(profile.role, language)}</p>
              </div>
            )}
          </a>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={signOut} title={t("Odjavi se", "Log out")}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-screen pb-20 lg:pb-0">
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-20 px-4 md:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Compass className="h-5 w-5" />
            </div>
            <span className="font-bold text-sm tracking-tight">Terenski Kompas</span>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-medium" aria-label={t("Radni prostori", "Workspaces")}>
            {visibleNav.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setWorkspace(item.id)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  workspace === item.id ? "bg-white dark:bg-slate-900 text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            <div className="relative hidden sm:block w-48">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder={t("Pretraga…", "Search…")} className="pl-8 h-9 text-xs rounded-lg" />
            </div>
            <LanguageToggle compact />
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => void loadData()} disabled={refreshing} aria-label={t("Osveži", "Refresh")}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-primary" : ""}`} />
            </Button>
            <Button
              variant={online ? "outline" : "destructive"}
              size="sm"
              className="h-9 gap-1.5 text-xs font-medium"
              onClick={() => void syncNow()}
            >
              {online ? <Signal className="h-3.5 w-3.5 text-emerald-500" /> : <CloudOff className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{online ? t("Na mreži", "Online") : t("Selo režim", "Village mode")}</span>
              {pending > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold text-[10px]">{pending}</span>}
            </Button>
          </div>
        </header>

        <div className="p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <p className="text-xs font-semibold tracking-wider text-primary uppercase">{workspaceEyebrow(workspace, t)}</p>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-0.5">{t(`Zdravo, ${firstName}.`, `Hello, ${firstName}.`)}</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">{workspaceDescription(workspace, t)}</p>
            </div>
          </div>

          {workspace === "field" && <FieldWorkspace data={data} pending={pending} onVisit={(task) => setVisitTask(task)} />}
          {workspace === "watcher" && <WatcherWorkspace incidents={data.incidents} onReport={() => setIncidentOpen(true)} />}
          {workspace === "leaderboard" && <LeaderboardWorkspace rows={data.leaderboard} />}
          {workspace === "finder" && <PollingStationFinder />}
          {workspace === "expenses" && <ExpensesWorkspace profile={profile} expenses={data.expenses} onSaved={() => void loadData(true)} />}
          {workspace === "help" && <HelpWorkspace documents={data.documents} />}
        </div>

        {/* Mobile Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around z-40 px-2 shadow-lg">
          {visibleNav.slice(0, 4).map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setWorkspace(item.id)}
              className={`flex flex-col items-center justify-center w-full py-1 gap-1 text-[11px] font-medium transition-colors ${
                workspace === item.id ? "text-primary font-semibold" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <span className="h-5 w-5 flex items-center justify-center">{item.icon}</span>
              <span>{item.short}</span>
            </button>
          ))}
          <a href="/profile" className="flex flex-col items-center justify-center w-full py-1 gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
            <Settings className="h-5 w-5" />
            <span>{t("Profil", "Profile")}</span>
          </a>
        </nav>
      </main>

      <VisitDialog open={visitTask !== undefined} task={visitTask ?? null} profile={profile} onClose={() => setVisitTask(undefined)} onSaved={() => void loadData(true)} />
      <IncidentDialog open={incidentOpen} profile={profile} onClose={() => setIncidentOpen(false)} onSaved={() => void loadData(true)} />
      <Toaster richColors position="top-center" />
    </div>
  );
}

function FieldWorkspace({ data, pending, onVisit }: { data: DashboardData; pending: number; onVisit: (task: FieldTask | null) => void }) {
  const { t, language } = useLanguage();
  const openTasks = data.tasks.filter((task) => task.status === "assigned" || task.status === "in_progress");
  const completedToday = data.visits.filter((visit) => isToday(visit.completed_at)).length;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric icon={<ClipboardList className="h-5 w-5 text-primary" />} label={t("Dodeljeni zadaci", "Assigned tasks")} value={openTasks.length} />
        <Metric icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} label={t("Posete danas", "Visits today")} value={completedToday} />
        <Metric icon={<MapPin className="h-5 w-5 text-blue-500" />} label={t("Ukupno poseta", "Total visits")} value={data.visits.length} />
        <Metric icon={<WifiOff className="h-5 w-5 text-amber-500" />} label={t("Čeka sinhronizaciju", "Queued offline")} value={pending} />
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">{t("TURNEJA", "TOUR SCHEDULE")}</p>
            <h2 className="text-lg font-bold tracking-tight">{t("Sledeće stanice i akcije", "Upcoming stops and actions")}</h2>
          </div>
          <Navigation className="h-5 w-5 text-muted-foreground" />
        </div>
        {data.tourStops.length === 0 ? (
          <EmptyState icon={<MapPin className="h-8 w-8 text-muted-foreground" />} title={t("Nema zakazanih stanica", "No scheduled stops")} text={t("Koordinator će ovde objaviti sledeću rutu.", "Your coordinator will publish the next route here.")} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.tourStops.map((stop) => (
              <article key={stop.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs">
                <time className="font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                  {new Intl.DateTimeFormat(language === "sr" ? "sr-RS" : "en-GB", { day: "2-digit", month: "short" }).format(new Date(`${stop.date}T12:00:00`))}
                </time>
                <div className="min-w-0 flex-1 px-2">
                  <p className="font-semibold truncate">{stop.location_name}</p>
                  <p className="text-muted-foreground truncate">{stop.municipality}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {stop.status.replaceAll("_", " ")}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm min-h-[420px]">
          <LiveFieldMap tasks={data.tasks} visits={data.visits} tourStops={data.tourStops} onSelectTask={onVisit} />
        </div>

        <aside className="lg:col-span-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">{t("MOJI ZADACI", "MY TASKS")}</p>
              <h2 className="text-base font-bold tracking-tight">{t("Sledeće adrese", "Next addresses")}</h2>
            </div>
            <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => onVisit(null)}>
              <Plus className="h-3.5 w-3.5" /> {t("Poseta", "Visit")}
            </Button>
          </div>
          {openTasks.length === 0 ? (
            <EmptyState icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />} title={t("Nema otvorenih zadataka", "No open tasks")} text={t("Koordinator još nije dodelio nove adrese.", "Your coordinator has not assigned new addresses yet.")} />
          ) : (
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[380px] pr-1">
              {openTasks.map((task) => (
                <article key={task.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 transition-colors">
                  <div className="min-w-0 pr-2 space-y-0.5">
                    <p className="font-semibold text-sm truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{task.address}, {task.city_village}</p>
                    <p className="text-[10px] text-primary font-medium">
                      {task.due_date ? new Intl.DateTimeFormat(language === "sr" ? "sr-RS" : "en-GB", { dateStyle: "medium" }).format(new Date(`${task.due_date}T12:00:00`)) : t("Bez roka", "No due date")}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onVisit(task)}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </article>
              ))}
            </div>
          )}
        </aside>
      </div>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">{t("AKTIVNOST", "ACTIVITY")}</p>
            <h2 className="text-base font-bold tracking-tight">{t("Nedavne terenske promene", "Recent field updates")}</h2>
          </div>
        </div>
        {data.activity.length === 0 ? (
          <EmptyState icon={<RefreshCw className="h-8 w-8 text-muted-foreground" />} title={t("Nema aktivnosti", "No activity yet")} text={t("Sinhronizovane posete i prijave pojaviće se ovde.", "Synced visits and reports will appear here.")} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.activity.map((entry) => (
              <article key={entry.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-xs">
                <RefreshCw className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold truncate">{activityLabel(entry.action, t)}</p>
                  <p className="text-muted-foreground text-[10px]">{new Intl.DateTimeFormat(language === "sr" ? "sr-RS" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.created_at))}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function activityLabel(action: string, t: (sr: string, en: string) => string) {
  return ({ visit_completed: t("Poseta je evidentirana", "Visit recorded"), incident_reported: t("Incident je prijavljen", "Incident reported"), expense_submitted: t("Trošak je poslat", "Expense submitted") } as Record<string, string>)[action] ?? action.replaceAll("_", " ");
}

function WatcherWorkspace({ incidents, onReport }: { incidents: Incident[]; onReport: () => void }) {
  const { t, language } = useLanguage();
  const critical = incidents.filter((incident) => incident.severity === "critical" && !["dismissed", "verified"].includes(incident.status)).length;
  const pending = incidents.filter((incident) => incident.status === "pending_review").length;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Metric icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} label={t("Otvorene prijave", "Open reports")} value={pending} />
        <Metric icon={<Radio className="h-5 w-5 text-destructive" />} label={t("Kritične", "Critical")} value={critical} />
        <Metric icon={<ShieldCheck className="h-5 w-5 text-primary" />} label={t("Ukupno prijava", "Total reports")} value={incidents.length} />
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">{t("IZBORNI DAN", "ELECTION DAY")}</p>
            <h2 className="text-lg font-bold tracking-tight">{t("Prijave incidenata", "Incident reports")}</h2>
          </div>
          <Button variant="destructive" size="sm" className="gap-1.5 text-xs font-semibold" onClick={onReport}>
            <AlertTriangle className="h-3.5 w-3.5" /> {t("Prijavi incident", "Report incident")}
          </Button>
        </div>

        {incidents.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="h-8 w-8 text-muted-foreground" />} title={t("Nema prijavljenih incidenata", "No incidents reported")} text={t("Nove prijave će se pojaviti ovde u realnom vremenu.", "New reports will appear here in real time.")} />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {incidents.map((incident) => (
              <article key={incident.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${incident.severity === "critical" ? "bg-red-500" : incident.severity === "medium" ? "bg-amber-500" : "bg-blue-500"}`} />
                    <span className="text-xs font-semibold text-muted-foreground">{incident.polling_station_number} · {incident.municipality}</span>
                  </div>
                  <h3 className="font-bold text-sm">{incident.title}</h3>
                  <p className="text-xs text-muted-foreground max-w-2xl">{incident.description}</p>
                </div>
                <div className="flex md:flex-col items-center md:items-end justify-between gap-1 text-xs">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {incidentStatus(incident.status, language)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Intl.DateTimeFormat(language === "sr" ? "sr-RS" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(incident.created_at))}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function LeaderboardWorkspace({ rows }: { rows: LeaderboardRow[] }) {
  const { t } = useLanguage();
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">{t("FAKULTETSKA TABELA", "FACULTY LEADERBOARD")}</p>
          <h2 className="text-lg font-bold tracking-tight">{t("Terenski učinak po fakultetima", "Field performance by faculty")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t("Rangiranje se automatski računa iz stvarno završenih poseta.", "Rankings are calculated automatically from completed visits.")}</p>
        </div>
        <Trophy className="h-6 w-6 text-amber-500" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Trophy className="h-8 w-8 text-muted-foreground" />} title={t("Još nema rezultata", "No results yet")} text={t("Tabela će se popuniti nakon prvih evidentiranih poseta i dodeljenih fakulteta.", "The board will populate after visits are recorded and faculties are assigned.")} />
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <article key={row.faculty} className="flex items-center justify-between p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <span className={`h-8 w-8 rounded-full font-bold text-xs flex items-center justify-center ${index === 0 ? "bg-amber-500 text-white" : index === 1 ? "bg-slate-300 text-slate-800" : index === 2 ? "bg-amber-700 text-white" : "bg-slate-100 dark:bg-slate-800 text-muted-foreground"}`}>
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-bold text-sm">{row.faculty}</h3>
                  <p className="text-xs text-muted-foreground">{row.active_volunteers} {t("aktivnih volontera", "active volunteers")} · {row.follow_ups} {t("praćenja", "follow-ups")}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-primary">{row.completed_visits}</span>
                <span className="block text-[10px] text-muted-foreground uppercase tracking-wider">{t("poseta", "visits")}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">{t("PRONALAZAČ BIRAČKOG MESTA", "POLLING STATION FINDER")}</p>
          <h2 className="text-lg font-bold tracking-tight mt-1">{t("Pronađi biračko mesto", "Find a polling station")}</h2>
          <p className="text-xs text-muted-foreground mt-1">{t("Unesi ulicu, opštinu ili broj biračkog mesta.", "Enter a street, municipality, or station number.")}</p>
        </div>
        <form onSubmit={search} className="space-y-3">
          <Input name="address" aria-label={t("Adresa ili broj biračkog mesta", "Address or polling station number")} placeholder={t("Na primer: Bulevar oslobođenja, Novi Sad", "For example: Bulevar oslobođenja, Novi Sad")} required />
          <Button type="submit" disabled={loading} className="w-full gap-2">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />} {t("Pronađi", "Find")}
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{t("Rezultati dolaze iz verifikovanog registra biračkih mesta u Supabase bazi.", "Results come from the verified polling-station registry in Supabase.")}</p>
      </div>

      <div className="lg:col-span-2 space-y-3">
        {!searched ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
            <EmptyState icon={<MapPin className="h-8 w-8 text-muted-foreground" />} title={t("Spremno za pretragu", "Ready to search")} text={t("Podaci o smeru i koordinatoru prikazuju se odmah nakon pretrage.", "Directions and coordinator details appear after searching.")} />
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
            <EmptyState icon={<Search className="h-8 w-8 text-muted-foreground" />} title={t("Nema poklapanja", "No match found")} text={t("Proveri adresu ili se obrati koordinatoru da dopuni registar.", "Check the address or ask an administrator to update the registry.")} />
          </div>
        ) : (
          results.map((station) => (
            <article key={station.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold text-primary uppercase">{station.municipality}</span>
                  <h3 className="text-lg font-bold">{station.station_number}</h3>
                  <p className="text-xs text-muted-foreground">{station.address}</p>
                </div>
                <a className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline" href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${station.latitude},${station.longitude}`} target="_blank" rel="noreferrer">
                  <Navigation className="h-3.5 w-3.5" /> {t("Otvori smer", "Open directions")}
                </a>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">{t("Koordinator", "Coordinator")}</span>
                  <span className="font-semibold">{station.coordinator_name || t("Nije dodeljen", "Not assigned")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">{t("Telefon", "Phone")}</span>
                  <span className="font-semibold">{station.coordinator_phone ? <a href={`tel:${station.coordinator_phone}`} className="text-primary">{station.coordinator_phone}</a> : t("Nije unet", "Not entered")}</span>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
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
    if (!supabase || !navigator.onLine) {
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className="lg:col-span-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">{t("PUTNI TROŠKOVI", "TRAVEL EXPENSES")}</p>
            <h2 className="text-lg font-bold tracking-tight">{t("Nova prijava", "New claim")}</h2>
          </div>
          <Receipt className="h-5 w-5 text-primary" />
        </div>
        <form className="space-y-3" onSubmit={submit}>
          <div><Label htmlFor="origin" className="text-xs">{t("Polazak", "Origin")}</Label><Input id="origin" name="origin" required /></div>
          <div><Label htmlFor="destination" className="text-xs">{t("Odredište", "Destination")}</Label><Input id="destination" name="destination" required /></div>
          <div><Label htmlFor="travel_date" className="text-xs">{t("Datum puta", "Travel date")}</Label><Input id="travel_date" name="travel_date" type="date" required /></div>
          <div>
            <Label className="text-xs">{t("Prevoz", "Transport")}</Label>
            <Select name="transport_type" defaultValue="bus">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bus">{t("Autobus", "Bus")}</SelectItem>
                <SelectItem value="train">{t("Voz", "Train")}</SelectItem>
                <SelectItem value="car">{t("Automobil", "Car")}</SelectItem>
                <SelectItem value="other">{t("Drugo", "Other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="amount_rsd" className="text-xs">{t("Iznos RSD", "Amount RSD")}</Label><Input id="amount_rsd" name="amount_rsd" type="number" min="1" step="0.01" required /></div>
          <div><Label htmlFor="receipt" className="text-xs">{t("Karta ili račun", "Ticket or receipt")}</Label><Input id="receipt" name="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" /></div>
          <div><Label htmlFor="expense_notes" className="text-xs">{t("Napomena", "Notes")}</Label><Textarea id="expense_notes" name="notes" /></div>
          <Button type="submit" disabled={busy} className="w-full gap-2">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />} {t("Pošalji na pregled", "Submit for review")}
          </Button>
        </form>
      </section>

      <section className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">{t("MOJE PRIJAVE", "MY CLAIMS")}</p>
          <h2 className="text-lg font-bold tracking-tight">{t("Status refundacija", "Reimbursement status")}</h2>
        </div>
        {expenses.length === 0 ? (
          <EmptyState icon={<Receipt className="h-8 w-8 text-muted-foreground" />} title={t("Nema prijavljenih troškova", "No expense claims")} text={t("Nove prijave i status pregleda pojaviće se ovde.", "New claims and review status will appear here.")} />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {expenses.map((expense) => (
              <article key={expense.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-sm">{expense.origin} → {expense.destination}</p>
                  <p className="text-muted-foreground">{new Intl.DateTimeFormat(language === "sr" ? "sr-RS" : "en-GB", { dateStyle: "medium" }).format(new Date(`${expense.travel_date}T12:00:00`))} · {expense.transport_type}</p>
                  {expense.admin_note && <p className="text-primary italic mt-0.5">{expense.admin_note}</p>}
                </div>
                <div className="text-right space-y-1">
                  <p className="font-bold text-sm">{expense.amount_rsd.toLocaleString(language === "sr" ? "sr-RS" : "en-GB")} RSD</p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {expenseStatus(expense.status, language)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function VisitDialog({ open, task, profile, onClose, onSaved }: { open: boolean; task: FieldTask | null; profile: Profile; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = crypto.randomUUID();
    const latitude = Number(form.get("latitude")), longitude = Number(form.get("longitude"));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !String(form.get("latitude") ?? "") || !String(form.get("longitude") ?? "")) {
      toast.error(t("Izaberite adresu ili upotrebite GPS lokaciju.", "Select an address or use your GPS location."));
      return;
    }
    const payload = { id, canvasser_id: profile.id, task_id: task?.id ?? null, latitude, longitude, address: String(form.get("address") ?? "").trim() || null, city_village: String(form.get("city_village") ?? "").trim() || profile.assigned_region || "Srbija", status: String(form.get("status") ?? "visited_neutral"), notes: String(form.get("notes") ?? "").trim() || null, follow_up_requested: form.get("follow_up") === "yes", completed_at: new Date().toISOString() };
    setBusy(true);
    const supabase = getSupabase();
    if (!supabase || !navigator.onLine) {
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("Zabeleži posetu", "Log a visit")}</DialogTitle>
            <DialogDescription>{task ? `${task.title} · ${task.address}` : t("Pretražite adresu ili upotrebite GPS lokaciju.", "Search for an address or use your GPS location.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <AddressCoordinatePicker address={task?.address ?? ""} locality={task?.city_village ?? profile.assigned_region ?? ""} latitude={task?.latitude ?? null} longitude={task?.longitude ?? null} />
            <div>
              <Label htmlFor="visit-outcome" className="text-xs">{t("Ishod", "Outcome")}</Label>
              <select id="visit-outcome" name="status" className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-xs shadow-sm" defaultValue="visited_neutral">
                <option value="visited_supporter">{t("Podržava", "Supporter")}</option>
                <option value="visited_neutral">{t("Neodlučan", "Neutral")}</option>
                <option value="visited_hostile">{t("Protiv", "Hostile")}</option>
                <option value="not_home">{t("Nije kod kuće", "Not home")}</option>
                <option value="refused">{t("Odbio razgovor", "Refused")}</option>
              </select>
            </div>
            <div>
              <Label htmlFor="visit-follow-up" className="text-xs">{t("Praćenje", "Follow-up")}</Label>
              <select id="visit-follow-up" name="follow_up" className="w-full mt-1 h-9 rounded-md border border-input bg-background px-3 text-xs shadow-sm" defaultValue="no">
                <option value="no">{t("Nije potrebno", "Not needed")}</option>
                <option value="yes">{t("Potrebno", "Required")}</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">{t("Beleška", "Notes")}</Label>
              <Textarea name="notes" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("Otkaži", "Cancel")}</Button>
            <Button type="submit" disabled={busy} className="gap-2">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {t("Sačuvaj posetu", "Save visit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
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
    if (!supabase || !navigator.onLine) {
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("Prijavi incident", "Report an incident")}</DialogTitle>
            <DialogDescription>{t("Vreme i lokacija se dodaju automatski kada su dostupni.", "Time and location are added automatically when available.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t("Biračko mesto", "Polling station")}</Label><Input name="polling_station_number" required /></div>
            <div><Label className="text-xs">{t("Opština", "Municipality")}</Label><Input name="municipality" required /></div>
            <div>
              <Label className="text-xs">{t("Ozbiljnost", "Severity")}</Label>
              <Select name="severity" defaultValue="medium">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("Niska", "Low")}</SelectItem>
                  <SelectItem value="medium">{t("Srednja", "Medium")}</SelectItem>
                  <SelectItem value="critical">{t("Kritična", "Critical")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">{t("Foto ili video", "Photo or video")}</Label><Input name="media" type="file" accept="image/*,video/mp4,video/quicktime" /></div>
            <div><Label className="text-xs">{t("Naslov", "Title")}</Label><Input name="title" required /></div>
            <div><Label className="text-xs">{t("Opis", "Description")}</Label><Textarea name="description" required /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("Otkaži", "Cancel")}</Button>
            <Button type="submit" disabled={busy} variant="destructive" className="gap-2">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />} {t("Pošalji prijavu", "Submit report")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 space-y-2">
      <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800">{icon}</div>
      <h3 className="font-bold text-sm tracking-tight">{title}</h3>
      <p className="text-xs text-muted-foreground max-w-sm">{text}</p>
    </div>
  );
}

function HelpWorkspace({ documents }: { documents: DashboardData["documents"] }) {
  const { t, language } = useLanguage();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
      <section className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider">{t("POMOĆ I PODRŠKA", "HELP & SUPPORT")}</p>
            <h2 className="text-lg font-bold tracking-tight">{t("Smernice za bezbedan terenski rad", "Safe field-work guidelines")}</h2>
          </div>
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-3">
          {documents.map((doc) => (
            <article key={doc.id} className="p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-1">
              <span className="text-[10px] font-semibold text-primary uppercase">{doc.category}</span>
              <h3 className="font-bold text-sm">{language === "sr" ? doc.title_sr : doc.title_en}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{language === "sr" ? doc.content_sr : doc.content_en}</p>
            </article>
          ))}
        </div>
      </section>

      <aside className="lg:col-span-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3 h-fit">
        <h3 className="font-bold text-base">{t("Potrebna je pomoć?", "Need help?")}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t("U hitnom slučaju pozovite 112. Za operativna pitanja obratite se svom regionalnom koordinatoru.", "Call 112 in an emergency. Contact your regional coordinator for operational questions.")}
        </p>
      </aside>
    </div>
  );
}

function navItems(t: (sr: string, en: string) => string): Array<{ id: Workspace; label: string; short: string; icon: ReactNode }> {
  return [
    { id: "field", label: t("Teren", "Field"), short: t("Teren", "Field"), icon: <Map className="h-4 w-4" /> },
    { id: "watcher", label: t("Kontrolor", "Watcher"), short: t("Kontrola", "Watch"), icon: <ShieldCheck className="h-4 w-4" /> },
    { id: "leaderboard", label: t("Fakulteti", "Faculties"), short: t("Tabela", "Board"), icon: <Trophy className="h-4 w-4" /> },
    { id: "finder", label: t("Biračko mesto", "Polling station"), short: t("Pronađi", "Find"), icon: <Search className="h-4 w-4" /> },
    { id: "expenses", label: t("Troškovi", "Expenses"), short: t("Troškovi", "Costs"), icon: <Receipt className="h-4 w-4" /> },
    { id: "help", label: t("Pomoć", "Help"), short: t("Pomoć", "Help"), icon: <ShieldCheck className="h-4 w-4" /> },
  ];
}

function roleWorkspaces(role: UserRole): Workspace[] {
  if (role === "canvasser") return ["field", "leaderboard", "finder", "expenses", "help"];
  if (role === "poll_watcher") return ["watcher", "finder", "expenses", "help"];
  return ["field", "watcher", "leaderboard", "finder", "expenses", "help"];
}

function workspaceEyebrow(workspace: Workspace, t: (sr: string, en: string) => string) {
  return ({ field: t("TERENSKI RAD", "FIELD OPERATIONS"), watcher: t("IZBORNI NADZOR", "ELECTION MONITORING"), leaderboard: t("GAMIFIKACIJA", "GAMIFICATION"), finder: t("BRZA PRETRAGA", "INSTANT LOOKUP"), expenses: t("REFUNDACIJE", "REIMBURSEMENTS"), help: t("POMOĆ I PODRŠKA", "HELP & SUPPORT") })[workspace];
}

function workspaceDescription(workspace: Workspace, t: (sr: string, en: string) => string) {
  return ({ field: t("Dodeljene adrese, mapa i evidencija obilaska.", "Assigned addresses, map, and visit logging."), watcher: t("Prijave i status incidenata sa biračkih mesta.", "Polling-station incident reports and statuses."), leaderboard: t("Učinak fakultetskih timova iz stvarnih terenskih podataka.", "Faculty team performance from live field data."), finder: t("Pronađi verifikovano biračko mesto i lokalnog koordinatora.", "Find a verified polling station and local coordinator."), expenses: t("Prijavi kartu ili putni trošak i prati odobrenje.", "Submit travel costs and track approval."), help: t("Proverene smernice, privatnost i bezbednost na terenu.", "Verified guidance, privacy, and field safety.") })[workspace];
}

function roleLabel(role: UserRole, language: "sr" | "en") {
  const labels = { admin: ["Administrator", "Administrator"], coordinator: ["Koordinator", "Coordinator"], canvasser: ["Volonter", "Canvasser"], poll_watcher: ["Poll watcher"] } as const;
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
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => navigator.geolocation.getCurrentPosition(
    (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
    () => resolve(null),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
  ));
}