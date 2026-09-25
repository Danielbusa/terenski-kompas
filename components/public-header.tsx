"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids a Vinext RSC prefetch crash. */

import { BrandMark } from "@/components/app-branding";
import { LanguageToggle, useLanguage } from "@/components/language-provider";

export function PublicHeader() {
  const { t } = useLanguage();
  return <header className="public-header">
    <a href="/" className="public-brand"><BrandMark /><span><b>Terenski Kompas</b><small>STUDENTSKA LISTA · SUSS</small></span></a>
    <nav><a href="/join">{t("Postani volonter", "Join us")}</a><a href="/donate">{t("Doniraj", "Donate")}</a><LanguageToggle compact /><a href="/login" className="login-link">{t("Prijavi se", "Sign in")}</a></nav>
  </header>;
}
