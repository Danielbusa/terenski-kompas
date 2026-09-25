"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabase } from "@/lib/supabase/client";

const LOGO_KEY = "terenski-kompas:logo";
const FAVICON_KEY = "terenski-kompas:favicon";
const BRAND_EVENT = "terenski-kompas:branding";

type BrandAssets = { logo: string | null; favicon: string | null };

function readAssets(): BrandAssets {
  if (typeof window === "undefined") return { logo: null, favicon: null };
  return { logo: localStorage.getItem(LOGO_KEY), favicon: localStorage.getItem(FAVICON_KEY) };
}

function applyFavicon(value: string | null) {
  if (typeof document === "undefined") return;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = value || "/favicon.svg";
}

export function useBranding() {
  const [assets, setAssets] = useState<BrandAssets>({ logo: null, favicon: null });
  useEffect(() => {
    const sync = () => { const next = readAssets(); setAssets(next); applyFavicon(next.favicon); };
    sync();
    const supabase = getSupabase();
    if (supabase) void supabase.from("app_config").select("value").eq("key", "nbs_ips").maybeSingle().then(({ data }) => {
      const value = data?.value as { logoDataUrl?: string; faviconDataUrl?: string } | undefined;
      if (value?.logoDataUrl) localStorage.setItem(LOGO_KEY, value.logoDataUrl); else localStorage.removeItem(LOGO_KEY);
      if (value?.faviconDataUrl) localStorage.setItem(FAVICON_KEY, value.faviconDataUrl); else localStorage.removeItem(FAVICON_KEY);
      sync();
    });
    window.addEventListener("storage", sync);
    window.addEventListener(BRAND_EVENT, sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener(BRAND_EVENT, sync); };
  }, []);
  return assets;
}

export async function saveBrandAsset(kind: keyof BrandAssets, file: File | null) {
  if (typeof window === "undefined") return;
  const key = kind === "logo" ? LOGO_KEY : FAVICON_KEY;
  let storedValue: string | null = null;
  if (!file) localStorage.removeItem(key);
  else {
    if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
    if (file.size > 1024 * 1024) throw new Error("Image must be smaller than 1 MB.");
    const value = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Image could not be read."));
      reader.readAsDataURL(file);
    });
    storedValue = value;
    localStorage.setItem(key, value);
  }
  const supabase = getSupabase();
  if (supabase) {
    const { data, error: readError } = await supabase.from("app_config").select("value").eq("key", "nbs_ips").maybeSingle();
    if (readError) throw readError;
    const current = (data?.value ?? {}) as Record<string, unknown>;
    const field = kind === "logo" ? "logoDataUrl" : "faviconDataUrl";
    const { error } = await supabase.rpc("admin_update_payment_config", { config: { ...current, [field]: storedValue } });
    if (error) throw error;
  }
  window.dispatchEvent(new Event(BRAND_EVENT));
}

export function BrandMark({ className }: { className?: string }) {
  const { logo } = useBranding();
  return <span className={cn("brand-mark", className)}>{logo ? <img src={logo} alt="Terenski Kompas" /> : <Compass />}</span>;
}
