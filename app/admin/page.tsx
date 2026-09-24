"use client";

/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-location-assign-relative-destination */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Clock3, Compass, LoaderCircle, RefreshCw, ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

type ApprovalStatus = "pending" | "approved" | "rejected";

type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  role: "admin" | "coordinator" | "canvasser" | "poll_watcher";
  assigned_region: string | null;
  approval_status: ApprovalStatus;
  created_at: string;
};

const statusLabels: Record<ApprovalStatus, string> = {
  pending: "Čeka odobrenje",
  approved: "Odobren",
  rejected: "Odbijen",
};

export default function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [access, setAccess] = useState<"checking" | "granted" | "denied" | "error">("checking");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadProfiles = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,email,phone_number,role,assigned_region,approval_status,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      setMessage(error.message);
      toast.error("Nalozi nisu učitani.", { description: error.message });
    } else {
      setProfiles((data ?? []) as Profile[]);
      setMessage("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        window.location.replace("/login?next=/admin");
        return;
      }
      setCurrentUserId(user.id);
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role,approval_status")
        .eq("id", user.id)
        .single();
      if (error) {
        setMessage(error.message);
        setAccess("error");
        setLoading(false);
        return;
      }
      if (profile.role !== "admin" || profile.approval_status !== "approved") {
        setAccess("denied");
        setLoading(false);
        return;
      }
      setAccess("granted");
      await loadProfiles();
    })();
  }, [loadProfiles]);

  const totals = useMemo(() => ({
    all: profiles.length,
    pending: profiles.filter((profile) => profile.approval_status === "pending").length,
    approved: profiles.filter((profile) => profile.approval_status === "approved").length,
    rejected: profiles.filter((profile) => profile.approval_status === "rejected").length,
  }), [profiles]);

  const changeStatus = async (profile: Profile, approvalStatus: ApprovalStatus) => {
    if (profile.id === currentUserId && approvalStatus !== "approved") {
      toast.error("Ne možeš ukinuti odobrenje sopstvenom administratorskom nalogu.");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    setBusyId(profile.id);
    const { error } = await supabase.rpc("admin_set_profile_approval", {
      target_user_id: profile.id,
      new_status: approvalStatus,
    });
    if (error) {
      toast.error("Status nije promenjen.", { description: error.message });
    } else {
      setProfiles((items) => items.map((item) => item.id === profile.id ? { ...item, approval_status: approvalStatus } : item));
      toast.success(`Status za ${profile.full_name} je ažuriran.`);
    }
    setBusyId(null);
  };

  const signOut = async () => {
    await getSupabase()?.auth.signOut();
    window.location.href = "/login";
  };

  if (!isSupabaseConfigured || access === "error") {
    return <AccessScreen title="Admin portal nije dostupan" text={message || "Supabase veza nije podešena."} />;
  }
  if (access === "checking") {
    return <main className="setup-screen"><LoaderCircle className="spin" /><p>Proveravamo administratorski pristup…</p></main>;
  }
  if (access === "denied") {
    return <AccessScreen title="Pristup nije dozvoljen" text="Ova stranica je dostupna samo odobrenim administratorima." />;
  }

  return <div className="admin-shell">
    <header className="admin-header">
      <a href="/" className="admin-brand"><span className="brand-mark"><Compass /></span><span><b>Terenski Kompas</b><small>ADMIN PORTAL</small></span></a>
      <div><a href="/"><ArrowLeft /> Terenski dashboard</a><button type="button" onClick={signOut}>Odjavi se</button></div>
    </header>
    <main className="admin-main">
      <div className="admin-title"><div><p className="eyebrow">UPRAVLJANJE PRISTUPOM</p><h1>Volonterski nalozi</h1><p>Pregled registracija i odobravanje pristupa terenskom dashboardu.</p></div><Button variant="outline" onClick={() => void loadProfiles()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} /> Osveži</Button></div>
      <section className="admin-stats" aria-label="Sažetak naloga">
        <StatCard icon={<Users />} label="Ukupno naloga" value={totals.all} />
        <StatCard icon={<Clock3 />} label="Čekaju odobrenje" value={totals.pending} tone="pending" />
        <StatCard icon={<UserCheck />} label="Odobreni" value={totals.approved} tone="approved" />
        <StatCard icon={<UserX />} label="Odbijeni" value={totals.rejected} tone="rejected" />
      </section>
      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>Korisnici</h2><p>Nalozi nastaju registracijom na stranici za prijavu.</p></div><span><ShieldCheck /> Zaštićeno administratorskim pravilima</span></div>
        {message && <p className="form-status error" role="alert">{message}</p>}
        {loading ? <div className="admin-loading"><LoaderCircle className="spin" /> Učitavanje naloga…</div> : profiles.length === 0 ? <div className="admin-empty"><Users /><h3>Nema registrovanih naloga</h3><p>Novi nalozi će se pojaviti ovde nakon registracije.</p></div> : <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Volonter</th><th>Uloga</th><th>Region</th><th>Registracija</th><th>Status</th></tr></thead>
          <tbody>{profiles.map((profile) => <tr key={profile.id}>
            <td><span className="profile-cell"><span className="profile-avatar">{initials(profile.full_name)}</span><span><b>{profile.full_name}</b><small>{profile.email || profile.phone_number || "Bez kontakta"}</small></span></span></td>
            <td><span className={`role-badge ${profile.role}`}>{roleLabel(profile.role)}</span></td>
            <td>{profile.assigned_region || "Nije dodeljen"}</td>
            <td>{new Intl.DateTimeFormat("sr-RS", { dateStyle: "medium" }).format(new Date(profile.created_at))}</td>
            <td><label className={`approval-control ${profile.approval_status}`}><span className="sr-only">Status za {profile.full_name}</span><select value={profile.approval_status} disabled={busyId === profile.id} onChange={(event) => void changeStatus(profile, event.target.value as ApprovalStatus)}><option value="pending">{statusLabels.pending}</option><option value="approved">{statusLabels.approved}</option><option value="rejected">{statusLabels.rejected}</option></select>{busyId === profile.id ? <LoaderCircle className="spin" /> : profile.approval_status === "approved" ? <Check /> : <Clock3 />}</label></td>
          </tr>)}</tbody>
        </table></div>}
      </section>
    </main>
    <Toaster richColors position="top-center" />
  </div>;
}

function AccessScreen({ title, text }: { title: string; text: string }) {
  return <main className="setup-screen"><div className="setup-card"><span className="brand-mark"><ShieldCheck /></span><p className="eyebrow">ZAŠTIĆENA ZONA</p><h1>{title}</h1><p>{text}</p><div><a href="/">Nazad na dashboard</a></div></div></main>;
}

function StatCard({ icon, label, value, tone = "" }: { icon: ReactNode; label: string; value: number; tone?: string }) {
  return <div className={`admin-stat ${tone}`}><span>{icon}</span><div><strong>{value}</strong><p>{label}</p></div></div>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TK";
}

function roleLabel(role: Profile["role"]) {
  return ({ admin: "Administrator", coordinator: "Koordinator", canvasser: "Volonter", poll_watcher: "Kontrolor" })[role];
}
