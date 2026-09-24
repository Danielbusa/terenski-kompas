"use client";
import {useEffect,useState} from "react";
import {ArrowLeft,Database,LoaderCircle,MapPinned,RefreshCw,ShieldCheck} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Toaster} from "@/components/ui/sonner";
import {getSupabase} from "@/lib/supabase/client";
type Result={imported?:number;historical_posts_found?:number;review_queue?:number;note?:string;error?:string};
export default function AdminDataPage(){const[authorized,setAuthorized]=useState<boolean|null>(null),[busy,setBusy]=useState(""),[result,setResult]=useState<Result|null>(null);
useEffect(()=>{void(async()=>{const s=getSupabase();if(!s)return setAuthorized(false);const{data:{session}}=await s.auth.getSession();if(!session)return location.replace("/login?next=/admin/data");const response=await fetch("/api/admin/authorize",{headers:{Authorization:`Bearer ${session.access_token}`}});setAuthorized(response.ok)})()},[]);
async function run(path:string,key:string){setBusy(key);setResult(null);const{data:{session}}=await getSupabase()!.auth.getSession();const response=await fetch(path,{method:"POST",headers:{Authorization:`Bearer ${session?.access_token??""}`}});const body=await response.json() as Result;setResult(body);response.ok?toast.success("Sinhronizacija je završena."):toast.error(body.error||"Sinhronizacija nije uspela.");setBusy("")}
if(authorized===null)return <main className="setup-screen"><LoaderCircle className="spin"/></main>;if(!authorized)return <main className="setup-screen"><ShieldCheck/><h1>Pristup nije dozvoljen</h1></main>;
return <main className="data-sync-page"><header><a href="/admin"><ArrowLeft/> Admin portal</a><p className="eyebrow">DATA PIPELINES</p><h1>Podaci i sinhronizacija</h1><p>Uvoz je ograničen na administratore. Postojeći redovi se bezbedno ažuriraju bez duplikata.</p></header><section className="sync-grid"><Card><Database/><div><h2>Lokacije Srbije</h2><p>Uvezi 9.514 naseljenih mesta iz GeoNames skupa u strogo kontrolisane padajuće liste.</p><Button onClick={()=>void run("/api/admin/import-locations","locations")} disabled={!!busy}>{busy==="locations"?<LoaderCircle className="spin"/>:<RefreshCw/>} Uvezi lokacije</Button></div></Card><Card><MapPinned/><div><h2>SUSS akcije i smernice</h2><p>Proveri javne SUSS izvore, osveži smernice i stavi nejasne istorijske objave u red za proveru pre objave na mapi.</p><Button onClick={()=>void run("/api/admin/sync-suss","suss")} disabled={!!busy}>{busy==="suss"?<LoaderCircle className="spin"/>:<RefreshCw/>} Sinhronizuj SUSS</Button></div></Card></section>{result&&<section className="sync-result"><h2>Rezultat</h2><pre>{JSON.stringify(result,null,2)}</pre></section>}<Toaster richColors position="top-center"/></main>}
