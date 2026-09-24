"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids a Vinext RSC prefetch crash. */

import { Compass } from "lucide-react";

export function PublicHeader() {
  return <header className="public-header">
    <a href="/" className="public-brand"><span className="brand-mark"><Compass /></span><span><b>Terenski Kompas</b><small>STUDENTSKA LISTA · SUSS</small></span></a>
    <nav><a href="/join">Postani volonter</a><a href="/donate">Doniraj</a><a href="/login" className="login-link">Prijavi se</a></nav>
  </header>;
}
