"use client";

import Link from "next/link";
import { Compass } from "lucide-react";

export function PublicHeader() {
  return <header className="public-header">
    <Link href="/" className="public-brand"><span className="brand-mark"><Compass /></span><span><b>Terenski Kompas</b><small>STUDENTSKA LISTA · SUSS</small></span></Link>
    <nav><Link href="/join">Postani volonter</Link><Link href="/donate">Doniraj</Link><Link href="/login" className="login-link">Prijavi se</Link></nav>
  </header>;
}
