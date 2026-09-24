"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Languages } from "lucide-react";

export type Language = "sr" | "en";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (serbian: string, english: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("sr");

  useEffect(() => {
    const saved = window.localStorage.getItem("terenski-kompas-language");
    if (saved === "sr" || saved === "en") queueMicrotask(() => setLanguageState(saved));
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage(next) {
      setLanguageState(next);
      window.localStorage.setItem("terenski-kompas-language", next);
      document.documentElement.lang = next === "sr" ? "sr-Latn" : "en";
    },
    t: (serbian, english) => language === "sr" ? serbian : english,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useLanguage();
  return <div className={`language-toggle ${compact ? "compact" : ""}`} aria-label={t("Izbor jezika", "Language selection")}>
    {!compact && <Languages aria-hidden="true" />}
    <button type="button" className={language === "sr" ? "active" : ""} onClick={() => setLanguage("sr")} aria-pressed={language === "sr"}>SR</button>
    <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} aria-pressed={language === "en"}>EN</button>
  </div>;
}
