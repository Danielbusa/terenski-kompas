"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, BarChart3, Bell, Camera, ChevronRight, CircleDot, CloudOff, Compass, HandCoins, Home, LocateFixed, Map, MapPin, Menu, Plus, QrCode, Radio, Route, Search, ShieldCheck, Signal, Sparkles, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { AuthGate } from "@/components/auth-gate";
import { getSupabase } from "@/lib/supabase/client";
import { enqueue } from "@/lib/offline-queue";

type Role = "field" | "watcher";
type Modal = "visit" | "recruit" | "incident" | "donation" | null;

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: {
        name: string;
        title?: string;
        description: string;
        inputSchema: object;
        annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
        execute: (input: unknown) => unknown;
      }, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

const points = [
  { x: 18, y: 22, tone: "support", label: "Bulevar oslobođenja 31" },
  { x: 33, y: 39, tone: "neutral", label: "Novosadska 8" },
  { x: 53, y: 24, tone: "away", label: "Braće Ribnikar 12" },
  { x: 67, y: 51, tone: "support", label: "Cara Dušana 47" },
  { x: 43, y: 67, tone: "hostile", label: "Zmaj Jovina 19" },
  { x: 79, y: 73, tone: "neutral", label: "Maksima Gorkog 4" },
];

const incidents = [
  { station: "BM 17", place: "Novi Sad", title: "Fotografisanje glasačkog listića", time: "pre 4 min", severity: "Kritično", status: "Nova" },
  { station: "BM 23", place: "Petrovaradin", title: "Grupno dovođenje birača", time: "pre 11 min", severity: "Srednje", status: "Provera" },
  { station: "BM 06", place: "Liman III", title: "Nedostaje kontrolni list", time: "pre 28 min", severity: "Kritično", status: "Pravna služba" },
];

const volunteers = [
  { initials: "MJ", name: "Milica Jovanović", region: "Novi Sad · Centar", visits: 31 },
  { initials: "LN", name: "Luka Nikolić", region: "Petrovaradin", visits: 28 },
  { initials: "AV", name: "Ana Vasić", region: "Liman", visits: 24 },
];

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="stat-card"><p>{label}</p><strong>{value}</strong><span>{note}</span></div>;
}

function MapCanvas() {
  const [selected, setSelected] = useState(0);
  const selectedPoint = points[selected];
  return <section className="map-shell" aria-label="Mapa obilaska">
    <div className="map-grid" aria-hidden="true"><span className="road road-a" /><span className="road road-b" /><span className="road road-c" /><span className="river" /></div>
    <div className="map-topbar"><div className="map-search"><Search /><span>Pretraži ulicu ili naselje</span></div><button className="round-btn" aria-label="Prikaži moju lokaciju" onClick={() => toast.success("Lokacija je osvežena")}><LocateFixed /></button></div>
    <div className="area-label area-one">STARI GRAD</div><div className="area-label area-two">PODGRAĐE</div>
    {points.map((point, index) => <button key={point.label} className={`map-point ${point.tone} ${selected === index ? "selected" : ""}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} onClick={() => setSelected(index)} aria-label={`${point.label}, ${point.tone}`}><Home /></button>)}
    <div className="route-line" aria-hidden="true" />
    <div className="map-card"><div className="map-card-head"><span className={`status-mark ${selectedPoint.tone}`} /><small>Sledeća adresa</small><span>420 m</span></div><h2>{selectedPoint.label}</h2><p>Ulaz sa dvorišne strane · 3 domaćinstva</p><Button onClick={() => toast("Ruta je pokrenuta", { description: "Prati sledeću adresu na mapi." })}><Route /> Pokreni rutu <ArrowRight /></Button></div>
    <div className="map-legend"><span><i className="support" /> Podržava</span><span><i className="neutral" /> Neodlučan</span><span><i className="away" /> Nije kod kuće</span></div>
  </section>;
}

function FieldView({ open }: { open: (modal: Modal) => void }) {
  return <div className="view-grid field-grid"><div className="main-column">
    <div className="view-heading"><div><p className="eyebrow">SREDA · NOVI SAD</p><h1>Dobro jutro, Milice.</h1><p>Rejon 04 je spreman. Danas imaš 18 planiranih adresa.</p></div><div className="sync-pill"><Signal /> Sinhronizovano</div></div><MapCanvas />
  </div><aside className="side-column">
    <div className="progress-card"><div className="progress-top"><span>Današnji cilj</span><strong>12 / 18</strong></div><div className="progress-track"><span style={{ width: "67%" }} /></div><p><Sparkles /> Još 6 adresa do dnevnog cilja</p></div>
    <div className="quick-card"><div className="card-title"><div><p className="eyebrow">BRZE AKCIJE</p><h2>Zabeleži na terenu</h2></div><Plus /></div>
      <button onClick={() => open("visit")}><span className="action-icon orange"><MapPin /></span><span><b>Zabeleži posetu</b><small>Status, beleška i praćenje</small></span><ChevronRight /></button>
      <button onClick={() => open("recruit")}><span className="action-icon blue"><UserPlus /></span><span><b>Novi volonter</b><small>Prijava preko QR koda</small></span><ChevronRight /></button>
      <button onClick={() => open("donation")}><span className="action-icon green"><HandCoins /></span><span><b>Mikro-donacija</b><small>Generiši IPS QR kod</small></span><ChevronRight /></button>
    </div>
    <div className="activity-card"><div className="card-title"><div><p className="eyebrow">POSLEDNJE</p><h2>Aktivnost u rejonu</h2></div><Activity /></div><div className="feed-row"><i className="support" /><span><b>Bulevar oslobođenja 31</b><small>Podržava · pre 8 min</small></span></div><div className="feed-row"><i className="neutral" /><span><b>Novosadska 8</b><small>Neodlučan · pre 16 min</small></span></div><button className="text-link" onClick={() => toast("Prikazano je svih 12 današnjih aktivnosti")}>Prikaži sve <ArrowRight /></button></div>
  </aside></div>;
}

function WatcherView({ open }: { open: (modal: Modal) => void }) {
  return <div className="watcher-view">
    <div className="view-heading"><div><p className="eyebrow">IZBORNI DAN · 09:42</p><h1>Kontrola biračkih mesta</h1><p>BM 17 · OŠ „Svetozar Marković Toza“ · Novi Sad</p></div><Button className="danger-btn" onClick={() => open("incident")}><AlertTriangle /> Prijavi incident</Button></div>
    <div className="watcher-summary"><div className="station-card"><span className="pulse"><Radio /></span><div><small>Status biračkog mesta</small><h2>Otvoreno · bez zastoja</h2><p>Poslednja provera pre 3 minuta</p></div><button onClick={() => toast.success("Status biračkog mesta je potvrđen")}>Potvrdi status</button></div><Stat label="Prijave danas" value="07" note="2 čekaju proveru" /><Stat label="Kritične" value="02" note="Obe prosleđene" /><Stat label="Kontrolori" value="86%" note="Na svojim mestima" /></div>
    <section className="panel incident-panel"><div className="panel-head"><div><p className="eyebrow">TOK PRIJAVA</p><h2>Incidenti u tvojoj opštini</h2></div><button className="filter-button"><CircleDot /> Sve prijave</button></div><div className="incident-list">
      {incidents.map((incident, i) => <article key={incident.station}><div className={`severity-icon s${i}`}><AlertTriangle /></div><div className="incident-main"><div className="incident-meta"><span>{incident.station}</span><span>{incident.place}</span><span>{incident.time}</span></div><h3>{incident.title}</h3><p>{i === 0 ? "Birač je zatečen kako fotografiše popunjen listić u kabini." : i === 1 ? "Dva kombija više puta dovoze organizovane grupe birača." : "Kontrolni list nije pronađen pri otvaranju glasačke kutije."}</p></div><div className="incident-state"><span className={i === 0 ? "critical" : "medium"}>{incident.severity}</span><small>{incident.status}</small></div><button className="round-btn" aria-label="Otvori incident" onClick={() => toast(incident.title, { description: "Detalji prijave su otvoreni za proveru." })}><ChevronRight /></button></article>)}
    </div></section>
  </div>;
}

function HQView() {
  return <div className="hq-view">
    <div className="view-heading"><div><p className="eyebrow">CENTAR ZA OPERACIJE</p><h1>Pregled kampanje</h1><p>Vojvodina · ažurirano pre nekoliko sekundi</p></div><Select defaultValue="vojvodina"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="vojvodina">Vojvodina</SelectItem><SelectItem value="beograd">Beograd</SelectItem><SelectItem value="srbija">Cela Srbija</SelectItem></SelectContent></Select></div>
    <div className="stat-grid"><Stat label="Posete danas" value="1.284" note="+18% u odnosu na juče" /><Stat label="Aktivni volonteri" value="342" note="47 trenutno na terenu" /><Stat label="Novi kontakti" value="96" note="21 za kontrolu izbora" /><Stat label="Otvoreni incidenti" value="12" note="3 zahtevaju reakciju" /></div>
    <div className="hq-grid"><section className="panel heat-panel"><div className="panel-head"><div><p className="eyebrow">POKRIVENOST TERENA</p><h2>Aktivnost po rejonima</h2></div><span className="live-badge"><i /> UŽIVO</span></div><div className="heat-map"><div className="heat h1" /><div className="heat h2" /><div className="heat h3" /><div className="heat h4" /><div className="heat h5" /><div className="heat h6" /><span className="city c1">NOVI SAD<b>78%</b></span><span className="city c2">BEOGRAD<b>64%</b></span><span className="city c3">KRAGUJEVAC<b>51%</b></span></div><div className="heat-footer"><span>Niža aktivnost</span><div><i /><i /><i /><i /><i /></div><span>Viša aktivnost</span></div></section>
      <section className="panel leaderboard"><div className="panel-head"><div><p className="eyebrow">VOLONTERI</p><h2>Najaktivniji danas</h2></div><Users /></div>{volunteers.map((v, i) => <div className="volunteer" key={v.name}><span className="rank">0{i + 1}</span><span className="avatar">{v.initials}</span><span><b>{v.name}</b><small>{v.region}</small></span><span className="visits"><b>{v.visits}</b><small>poseta</small></span></div>)}<button className="text-link" onClick={() => toast("Otvoren je registar volontera")}>Upravljaj volonterima <ArrowRight /></button></section>
    </div>
  </div>;
}

function EntryDialog({ modal, close }: { modal: Modal; close: () => void }) {
  const config = useMemo(() => ({
    visit: { title: "Zabeleži posetu", desc: "Podaci će biti sačuvani i ako trenutno nema mreže.", action: "Sačuvaj posetu" },
    recruit: { title: "Prijavi novog volontera", desc: "Unesi osnovne podatke ili podeli QR kod za samostalnu prijavu.", action: "Sačuvaj volontera" },
    incident: { title: "Prijavi incident", desc: "Lokacija i vreme će biti automatski dodati uz prijavu.", action: "Pošalji na proveru" },
    donation: { title: "Generiši IPS QR", desc: "Donator skenira kod u aplikaciji svoje banke.", action: "Generiši kod" },
  } as const)[modal as Exclude<Modal, null>], [modal]);
  if (!config) return null;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (modal === "donation") {
      window.location.href = "/donate";
      return;
    }
    const data = new FormData(event.currentTarget);
    const supabase = getSupabase();
    const session = await supabase?.auth.getSession();
    const userId = session?.data.session?.user.id ?? null;
    let table: "canvassing_points" | "recruits" | "incidents" = "canvassing_points";
    let payload: Record<string, unknown> = {};
    if (modal === "visit") {
      payload = { canvasser_id: userId, latitude: 45.2671, longitude: 19.8335, address_street: String(data.get("address") ?? ""), city_village: "Novi Sad", status: String(data.get("status") ?? "visited_neutral"), notes: String(data.get("notes") ?? ""), follow_up_requested: data.get("followup") === "yes" };
    } else if (modal === "recruit") {
      table = "recruits";
      payload = { recruiter_id: userId, full_name: String(data.get("full_name") ?? ""), phone_number: String(data.get("phone_number") ?? ""), city_village: String(data.get("city_village") ?? ""), interested_in_poll_watching: false, source: "field" };
    } else if (modal === "incident") {
      table = "incidents";
      const media = data.get("media");
      const mediaUrls: string[] = [];
      if (supabase && navigator.onLine && media instanceof File && media.size) {
        const path = `${userId}/${crypto.randomUUID()}-${media.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
        const upload = await supabase.storage.from("incident-media").upload(path, media);
        if (upload.error) return toast.error("Prilog nije otpremljen. Proveri veličinu i pokušaj ponovo.");
        mediaUrls.push(upload.data.path);
      }
      payload = { reporter_id: userId, polling_station_number: String(data.get("polling_station") ?? ""), municipality: "Novi Sad", title: String(data.get("title") ?? ""), description: String(data.get("description") ?? ""), severity: String(data.get("severity") ?? "medium"), media_urls: mediaUrls, latitude: 45.2671, longitude: 19.8335 };
    }
    if (!supabase || !navigator.onLine) {
      await enqueue(table, payload);
      close();
      toast.success("Sačuvano na uređaju. Sinhronizovaće se kada se mreža vrati.");
      return;
    }
    const result = await supabase.from(table).insert(payload);
    if (result.error) toast.error("Podatak nije sačuvan. Proveri pristup i pokušaj ponovo.");
    else { close(); toast.success("Sačuvano i sinhronizovano."); }
  };
  return <Dialog open={Boolean(modal)} onOpenChange={(v) => !v && close()}><DialogContent className="entry-dialog"><form onSubmit={submit} className="dialog-form"><DialogHeader><div className="dialog-mark">{modal === "incident" ? <AlertTriangle /> : modal === "donation" ? <QrCode /> : modal === "recruit" ? <UserPlus /> : <MapPin />}</div><DialogTitle>{config.title}</DialogTitle><DialogDescription>{config.desc}</DialogDescription></DialogHeader>
    {modal === "visit" && <div className="form-grid"><div className="form-wide"><Label>Adresa</Label><Input name="address" defaultValue="Bulevar oslobođenja 31" required /></div><div><Label>Status</Label><Select name="status" defaultValue="visited_supporter"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="visited_supporter">Podržava</SelectItem><SelectItem value="visited_neutral">Neodlučan</SelectItem><SelectItem value="not_home">Nije kod kuće</SelectItem><SelectItem value="refused">Odbio razgovor</SelectItem></SelectContent></Select></div><div><Label>Praćenje</Label><Select name="followup" defaultValue="no"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="no">Nije potrebno</SelectItem><SelectItem value="yes">Pozvati ponovo</SelectItem></SelectContent></Select></div><div className="form-wide"><Label>Beleška</Label><Textarea name="notes" placeholder="Kratka beleška sa razgovora…" /></div></div>}
    {modal === "recruit" && <div className="form-grid"><div><Label>Ime i prezime</Label><Input name="full_name" placeholder="Jovana Petrović" required /></div><div><Label>Telefon</Label><Input name="phone_number" placeholder="+381 6…" required /></div><div className="form-wide"><Label>Mesto</Label><Input name="city_village" placeholder="Novi Sad" required /></div><a className="qr-option" href="/join" target="_blank"><QrCode /><span><b>Otvori javnu prijavu</b><small>Volonter unosi svoje podatke</small></span><ChevronRight /></a></div>}
    {modal === "incident" && <div className="form-grid"><div><Label>Biračko mesto</Label><Input name="polling_station" defaultValue="BM 17" required /></div><div><Label>Ozbiljnost</Label><Select name="severity" defaultValue="medium"><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Niska</SelectItem><SelectItem value="medium">Srednja</SelectItem><SelectItem value="critical">Kritična</SelectItem></SelectContent></Select></div><div className="form-wide"><Label>Naslov</Label><Input name="title" placeholder="Šta se dogodilo?" required /></div><div className="form-wide"><Label>Opis</Label><Textarea name="description" placeholder="Opiši događaj što preciznije…" required /></div><label className="upload-option"><Camera /><span><b>Dodaj fotografiju ili video</b><small>Jedan prilog · najviše 50 MB</small></span><Input name="media" type="file" accept="image/*,video/*" className="sr-only" /></label></div>}
    {modal === "donation" && <div className="form-grid"><div><Label>Iznos (RSD)</Label><Input type="number" defaultValue="1000" /></div><div><Label>Ime donatora</Label><Input placeholder="Anonimno" /></div><div className="form-wide donation-note"><ShieldCheck /><span><b>Bezbedno IPS plaćanje</b><small>Aplikacija ne čuva podatke platne kartice.</small></span></div></div>}
    <DialogFooter><Button type="button" variant="outline" onClick={close}>Otkaži</Button><Button type="submit">{config.action}<ArrowRight /></Button></DialogFooter>
  </form></DialogContent></Dialog>;
}

function Dashboard() {
  const [role, setRole] = useState<Role>("field");
  const [modal, setModal] = useState<Modal>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "navigate_to_role_workspace",
      title: "Otvori radni prostor",
      description: "Switch the visible Terenski Kompas workspace to field canvassing, poll watching, or HQ operations.",
      inputSchema: { type: "object", properties: { role: { type: "string", enum: ["field", "watcher", "hq"] } }, required: ["role"], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        const value = (input as { role?: string })?.role;
        if (value === "hq") {
          window.location.href = "/admin";
          return { role: value, status: "opening_admin_portal" };
        }
        if (value !== "field" && value !== "watcher") throw new Error("Invalid role");
        setRole(value);
        return { role: value, status: "visible" };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    void Promise.resolve(context.registerTool({
      name: "start_field_entry",
      title: "Započni terenski unos",
      description: "Open the visible form for a visit, recruit, incident, or donation entry without submitting it.",
      inputSchema: { type: "object", properties: { entryType: { type: "string", enum: ["visit", "recruit", "incident", "donation"] } }, required: ["entryType"], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        const value = (input as { entryType?: string })?.entryType;
        if (value !== "visit" && value !== "recruit" && value !== "incident" && value !== "donation") throw new Error("Invalid entry type");
        setModal(value);
        return { entryType: value, status: "form_open" };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);
  const signOut = async () => {
    await getSupabase()?.auth.signOut();
    window.location.href = "/login";
  };
  return <div className="app-shell"><aside className="desktop-rail"><div className="brand-mark"><Compass /></div><nav aria-label="Glavna navigacija"><button className={role === "field" ? "active" : ""} onClick={() => setRole("field")} title="Teren"><Map /></button><button className={role === "watcher" ? "active" : ""} onClick={() => setRole("watcher")} title="Kontrola"><ShieldCheck /></button><a href="/admin" title="Admin portal"><BarChart3 /></a></nav><button className="avatar-button" title="Odjavi se" onClick={signOut}>MJ</button></aside>
    <main className="app-main"><header className="topbar"><div className="brand"><span className="brand-mark"><Compass /></span><div><b>Terenski Kompas</b><small>STUDENTSKA LISTA · SUSS</small></div></div><Tabs value={role} onValueChange={(v) => setRole(v as Role)} className="role-tabs"><TabsList><TabsTrigger value="field">Teren</TabsTrigger><TabsTrigger value="watcher">Kontrolor</TabsTrigger><a href="/admin" className="admin-tab-link">Centrala</a></TabsList><TabsContent value="field" /><TabsContent value="watcher" /></Tabs><div className="top-actions"><span className={online ? "online" : "offline"}>{online ? <Signal /> : <CloudOff />}{online ? "Na mreži" : "Rad van mreže"}</span><button className="round-btn" aria-label="Obaveštenja"><Bell /><i /></button><button className="menu-btn" aria-label="Meni"><Menu /></button></div></header>
      <div className="content-wrap">{role === "field" && <FieldView open={setModal} />}{role === "watcher" && <WatcherView open={setModal} />}</div>
      <nav className="mobile-nav" aria-label="Mobilna navigacija"><button className={role === "field" ? "active" : ""} onClick={() => setRole("field")}><Map /><span>Teren</span></button><button className={role === "watcher" ? "active" : ""} onClick={() => setRole("watcher")}><ShieldCheck /><span>Kontrola</span></button><button className="mobile-add" onClick={() => setModal(role === "watcher" ? "incident" : "visit")}><Plus /></button><a href="/admin"><BarChart3 /><span>Centrala</span></a><button onClick={() => toast("Profil je spreman za pregled")}><Users /><span>Profil</span></button></nav>
    </main><EntryDialog modal={modal} close={() => setModal(null)} /><Toaster richColors position="top-center" /></div>;
}

export default function HomePage() {
  return <AuthGate><Dashboard /></AuthGate>;
}
