"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";

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
    window.addEventListener("storage", sync);
    window.addEventListener(BRAND_EVENT, sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener(BRAND_EVENT, sync); };
  }, []);
  return assets;
}

export async function saveBrandAsset(kind: keyof BrandAssets, file: File | null) {
  if (typeof window === "undefined") return;
  const key = kind === "logo" ? LOGO_KEY : FAVICON_KEY;
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
    localStorage.setItem(key, value);
  }
  window.dispatchEvent(new Event(BRAND_EVENT));
}

export function BrandMark({ className }: { className?: string }) {
  const { logo } = useBranding();
  return <span className={cn("brand-mark", className)}>{logo ? <img src={logo} alt="Terenski Kompas" /> : <Compass />}</span>;
}
