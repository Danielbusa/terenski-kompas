import React, { useState, useEffect } from "react";
import {
  MapPin,
  Users,
  ShieldAlert,
  Trophy,
  Search,
  Receipt,
  HelpCircle,
  Wifi,
  WifiOff,
  Plus,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  ChevronRight,
  Menu,
  X,
  UserCheck,
  UserX,
  HelpCircle as QuestionIcon,
  Home
} from "lucide-react";

// Import your custom map and log visit form components
import FieldMap from "./components_field-map";
import LogVisitForm from "./components_log-visit-form";

// --- Types & Interfaces ---
export type WorkspaceTab = "field" | "watcher" | "leaderboard" | "finder" | "expenses" | "help";

export interface VisitRecord {
  id: string;
  address: string;
  municipality: string;
  lat: number;
  lng: number;
  outcome: "Supporter" | "Undecided" | "Not Interested" | "Not Home" | "Invalid Address";
  notes?: string;
  created_at: string;
  is_offline_synced?: boolean;
}

export interface IncidentRecord {
  id: string;
  type: string;
  description: string;
  location: string;
  timestamp: string;
  severity: "Low" | "Medium" | "High" | "Critical";
}

export default function OperationsDashboard() {
  // --- Navigation & Sidebar State ---
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceTab>("field");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // --- Network & "Selo" (Offline) Mode State ---
  const [isSeloMode, setIsSeloMode] = useState<boolean>(false);
  const [offlineQueue, setOfflineQueue] = useState<VisitRecord[]>([]);

  // --- Core Operational Data State ---
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [selectedMapLocation, setSelectedMapLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);

  // --- Dialog & Modal States ---
  const [isLogVisitOpen, setIsLogVisitOpen] = useState<boolean>(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState<boolean>(false);

  // --- Initial Data Pre-load & Real-time Subscription Mock/Setup ---
  useEffect(() => {
    // Simulated initial fetch of visits
    const initialVisits: VisitRecord[] = [
      {
        id: "1",
        address: "Kralja Petra I 14",
        municipality: "Ruma",
        lat: 44.98,
        lng: 19.82,
        outcome: "Supporter",
        notes: "Porodica podržava kampanju.",
        created_at: new Date(Date.now() - 3600000).toISOString(),
        is_offline_synced: true,
      },
      {
        id: "2",
        address: "Glavna 102",
        municipality: "Ruma",
        lat: 44.982,
        lng: 19.825,
        outcome: "Undecided",
        notes: "Tražili više informacija o lokalnom programu.",
        created_at: new Date(Date.now() - 7200000).toISOString(),
        is_offline_synced: true,
      },
      {
        id: "3",
        address: "Železnička 45",
        municipality: "Kraljevci",
        lat: 44.975,
        lng: 19.88,
        outcome: "Not Home",
        notes: "Ostavljen letak u poštanskom sandučetu.",
        created_at: new Date(Date.now() - 10800000).toISOString(),
        is_offline_synced: true,
      },
    ];

    setVisits(initialVisits);
  }, []);

  // --- Offline Queue Sync Handler ---
  const handleSyncOfflineQueue = () => {
    if (offlineQueue.length === 0) return;
    setVisits((prev) => [...offlineQueue, ...prev]);
    setOfflineQueue([]);
  };

  // --- Visit Logging Handler ---
  const handleNewVisit = (newVisit: Omit<VisitRecord, "id" | "created_at">) => {
    const record: VisitRecord = {
      ...newVisit,
      id: `visit-${Date.now()}`,
      created_at: new Date().toISOString(),
      is_offline_synced: !isSeloMode,
    };

    if (isSeloMode) {
      setOfflineQueue((prev) => [record, ...prev]);
    } else {
      setVisits((prev) => [record, ...prev]);
    }
    setIsLogVisitOpen(false);
  };

  // --- Computed Metrics ---
  const totalVisits = visits.length + offlineQueue.length;
  const supporters = visits.filter((v) => v.outcome === "Supporter").length;
  const undecided = visits.filter((v) => v.outcome === "Undecided").length;
  const notInterested = visits.filter((v) => v.outcome === "Not Interested").length;

  // --- Navigation Items Configuration (Preserving all 6 workspace items) ---
  const navigationItems = [
    { id: "field", label: "Terenski rad", icon: MapPin, badge: totalVisits > 0 ? totalVisits : null },
    { id: "watcher", label: "Posmatrači / Kontrola", icon: ShieldAlert, badge: incidents.length > 0 ? incidents.length : null },
    { id: "leaderboard", label: "Rang lista", icon: Trophy, badge: null },
    { id: "finder", label: "Nalazač", icon: Search, badge: null },
    { id: "expenses", label: "Troškovi", icon: Receipt, badge: null },
    { id: "help", label: "Pomoć i Podrška", icon: HelpCircle, badge: null },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* ================= SIDEBAR ================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col justify-between p-4">
          <div>
            {/* Logo / Header */}
            <div className="flex items-center justify-between px-2 py-3 mb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-bold text-slate-100 leading-tight">Terenski Kompas</h1>
                  <p className="text-xs text-slate-400">Operativni Centar</p>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeWorkspace === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveWorkspace(item.id as WorkspaceTab)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== null && (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300 border border-slate-700">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Sidebar - "Selo" Offline Toggle & Status */}
          <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isSeloMode ? (
                  <WifiOff className="h-4 w-4 text-amber-400 animate-pulse" />
                ) : (
                  <Wifi className="h-4 w-4 text-emerald-400" />
                )}
                <span className="text-xs font-semibold text-slate-300">
                  {isSeloMode ? "Selo Režim (Offline)" : "Mreža Aktivna"}
                </span>
              </div>
              <button
                onClick={() => setIsSeloMode(!isSeloMode)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isSeloMode ? "bg-amber-500" : "bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isSeloMode ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {offlineQueue.length > 0 && (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-amber-400 font-medium">
                  {offlineQueue.length} na čekanju
                </span>
                <button
                  onClick={handleSyncOfflineQueue}
                  disabled={isSeloMode}
                  className="text-xs text-emerald-400 hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  Sinhronizuj
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ================= MAIN CONTENT AREA ================= */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900/50 px-6 backdrop-blur">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-slate-400 hover:text-slate-200"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h2 className="text-lg font-semibold text-slate-100 capitalize">
              {navigationItems.find((i) => i.id === activeWorkspace)?.label}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsIncidentModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition"
            >
              <ShieldAlert className="h-4 w-4" />
              <span className="hidden sm:inline">Prijavi Incident</span>
            </button>

            <button
              onClick={() => setIsLogVisitOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/20"
            >
              <Plus className="h-4 w-4" />
              <span>Zabeleži Posetu</span>
            </button>
          </div>
        </header>

        {/* Dynamic Workspace Content Switcher */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeWorkspace === "field" && (
            <>
              {/* Lovable Design KPI Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Ukupno Poseta</span>
                    <BarChart3 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-100">{totalVisits}</div>
                  <p className="mt-1 text-xs text-slate-500">
                    {offlineQueue.length > 0 ? `${offlineQueue.length} offline na čekanju` : "Svi podaci sinhronizovani"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Podržavaoci</span>
                    <UserCheck className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-emerald-400">{supporters}</div>
                  <p className="mt-1 text-xs text-slate-500">
                    {totalVisits > 0 ? `${Math.round((supporters / totalVisits) * 100)}% ukupnog terena` : "0%"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Neodlučni</span>
                    <QuestionIcon className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-amber-400">{undecided}</div>
                  <p className="mt-1 text-xs text-slate-500">Ciljna grupa za ponovnu posetu</p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">Nisu Opredeljeni</span>
                    <UserX className="h-4 w-4 text-rose-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-400">{notInterested}</div>
                  <p className="mt-1 text-xs text-slate-500">Odbijeni ili neprijateljski</p>
                </div>
              </div>

              {/* Main Content Split: Map & Quick Visit Feed */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Interactive Map */}
                <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden h-[480px] relative">
                  <FieldMap
                    visits={visits}
                    onSelectLocation={(loc) => {
                      setSelectedMapLocation(loc);
                      setIsLogVisitOpen(true);
                    }}
                  />
                </div>

                {/* Recent Visits Activity Feed */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col h-[480px]">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                    <h3 className="font-semibold text-slate-200 text-sm">Poslednje Aktivnosti</h3>
                    <span className="text-xs text-slate-500">{visits.length} zabeleženo</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {visits.map((visit) => (
                      <div
                        key={visit.id}
                        className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/80 hover:border-slate-700 transition"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-200">{visit.address}</p>
                            <p className="text-xs text-slate-400">{visit.municipality}</p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              visit.outcome === "Supporter"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : visit.outcome === "Undecided"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {visit.outcome}
                          </span>
                        </div>
                        {visit.notes && <p className="mt-2 text-xs text-slate-400 italic">"{visit.notes}"</p>}
                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                          <span>{new Date(visit.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <span>{visit.is_offline_synced ? "Sinhronizovano" : "Čeka mrežu"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Placeholder for Watcher workspace */}
          {activeWorkspace === "watcher" && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
              <ShieldAlert className="mx-auto h-12 w-12 text-rose-400 mb-3" />
              <h3 className="text-lg font-semibold text-slate-200">Kontrola Izbornih Mesta</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                Pratite izlaznost, kontrolore i nepravilnosti u realnom vremenu.
              </p>
            </div>
          )}

          {/* Placeholder for Leaderboard workspace */}
          {activeWorkspace === "leaderboard" && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
              <Trophy className="mx-auto h-12 w-12 text-amber-400 mb-3" />
              <h3 className="text-lg font-semibold text-slate-200">Rang Lista Volontera</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                Pregled najaktivnijih timova i pojedinaca na terenu.
              </p>
            </div>
          )}

          {/* Placeholder for Finder workspace */}
          {activeWorkspace === "finder" && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
              <Search className="mx-auto h-12 w-12 text-emerald-400 mb-3" />
              <h3 className="text-lg font-semibold text-slate-200">Nalazač Adresa i Birača</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                Pretražujte biračka mesta, ulice i rejonizaciju.
              </p>
            </div>
          )}

          {/* Placeholder for Expenses workspace */}
          {activeWorkspace === "expenses" && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
              <Receipt className="mx-auto h-12 w-12 text-blue-400 mb-3" />
              <h3 className="text-lg font-semibold text-slate-200">Evidencija Troškova</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                Unosite i pratite troškove goriva, materijala i logistike.
              </p>
            </div>
          )}

          {/* Placeholder for Help workspace */}
          {activeWorkspace === "help" && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
              <HelpCircle className="mx-auto h-12 w-12 text-indigo-400 mb-3" />
              <h3 className="text-lg font-semibold text-slate-200">Pomoć i Uputstva</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                Tehnička podrška, kontakti koordinatora i vodič za rad na terenu.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* ================= MODAL: LOG VISIT ================= */}
      {isLogVisitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="text-lg font-bold text-slate-100">Zabeleži Posetu Domaćinstvu</h3>
              <button
                onClick={() => setIsLogVisitOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <LogVisitForm
              initialLocation={selectedMapLocation}
              onSubmit={handleNewVisit}
              onCancel={() => setIsLogVisitOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ================= MODAL: REPORT INCIDENT ================= */}
      {isIncidentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <h3 className="text-lg font-bold text-rose-400">Prijavi Nepravilnost / Incident</h3>
              <button
                onClick={() => setIsIncidentModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsIncidentModalOpen(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tip Incidenta</label>
                <select className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500">
                  <option>Neregularnost na Biračkom Mesto</option>
                  <option>Pritisak / Zastrašivanje</option>
                  <option>Nedostajući Materijal</option>
                  <option>Ostalo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Opis Događaja</label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-rose-500"
                  placeholder="Kratak opis incidenta i lokacije..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsIncidentModalOpen(false)}
                  className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Otkaži
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500"
                >
                  Pošalji Prijavu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}