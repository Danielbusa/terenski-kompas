"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, LoaderCircle, LocateFixed, Search } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Result = { id:string; label:string; latitude:number; longitude:number; locality:string };

export function AddressCoordinatePicker({ address = "", locality = "", latitude = null, longitude = null }: { address?:string; locality?:string; latitude?:number|null; longitude?:number|null }) {
  const { t } = useLanguage();
  const [query,setQuery] = useState(address);
  const [city,setCity] = useState(locality);
  const [lat,setLat] = useState<number|null>(latitude);
  const [lng,setLng] = useState<number|null>(longitude);
  const [results,setResults] = useState<Result[]>([]);
  const [searching,setSearching] = useState(false);
  const [locating,setLocating] = useState(false);

  useEffect(() => { setQuery(address); setCity(locality); setLat(latitude); setLng(longitude); setResults([]); }, [address, locality, latitude, longitude]);

  const search = async (event:FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 3) return toast.error(t("Unesite najmanje tri znaka.","Enter at least three characters."));
    setSearching(true);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t("Pretraga adrese nije uspela.","Address search failed."));
      setResults(body);
      if (!body.length) toast.info(t("Nema rezultata u Srbiji.","No results found in Serbia."));
    } catch (error) { toast.error(t("Pretraga adrese nije uspela.","Address search failed."),{description:error instanceof Error?error.message:undefined}); }
    finally { setSearching(false); }
  };

  const choose = (result:Result) => { setQuery(result.label); setCity(result.locality); setLat(result.latitude); setLng(result.longitude); setResults([]); };
  const locate = () => {
    if (!navigator.geolocation) return toast.error(t("GPS nije dostupan u ovom pregledaču.","GPS is not available in this browser."));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(({coords}) => {
      setLat(coords.latitude); setLng(coords.longitude); setQuery(t("Trenutna GPS lokacija","Current GPS location")); setResults([]); setLocating(false);
    },(error)=>{setLocating(false);toast.error(t("Lokacija nije dostupna.","Location is unavailable."),{description:error.message})},{enableHighAccuracy:true,timeout:12000,maximumAge:15000});
  };

  return <div className="form-wide address-picker">
    <Label htmlFor="visit-address-search">{t("Pretraži adresu","Search address")}</Label>
    <div className="address-search-row">
      <Input id="visit-address-search" value={query} onChange={event=>{setQuery(event.target.value);setLat(null);setLng(null)}} placeholder={t("Ulica, broj, mesto","Street, number, city or village")} autoComplete="street-address" />
      <Button type="button" variant="outline" onClick={search} disabled={searching}>{searching?<LoaderCircle className="spin"/>:<Search/>}<span>{t("Pretraži","Search")}</span></Button>
      <Button type="button" variant="outline" onClick={locate} disabled={locating}>{locating?<LoaderCircle className="spin"/>:<LocateFixed/>}<span>{t("Moja lokacija","Use my location")}</span></Button>
    </div>
    {results.length>0&&<div className="address-results" role="listbox">{results.map(result=><button type="button" key={result.id} onClick={()=>choose(result)}><MapResult/><span>{result.label}</span></button>)}</div>}
    {lat!=null&&lng!=null&&<p className="coordinate-confirmation"><CheckCircle2/>{t("Lokacija je spremna","Location selected")} · {lat.toFixed(5)}, {lng.toFixed(5)}</p>}
    <input type="hidden" name="address" value={query}/><input type="hidden" name="city_village" value={city}/><input type="hidden" name="latitude" value={lat??""}/><input type="hidden" name="longitude" value={lng??""}/>
  </div>;
}

function MapResult(){return <LocateFixed aria-hidden="true"/>}
