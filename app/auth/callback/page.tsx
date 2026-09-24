"use client";

import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";

function safeNext(params: URLSearchParams) {
  const value = params.get("next") ?? "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function AuthCallbackPage() {
  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = getSupabase();
      if (!supabase) {
        window.location.replace("/login?error=config");
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const result = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.getSession();
      if (!active) return;
      const session = "session" in result.data ? result.data.session : null;
      window.location.replace(session ? safeNext(params) : "/login?error=link");
    })().catch(() => {
      if (active) window.location.replace("/login?error=link");
    });
    return () => { active = false; };
  }, []);

  return <main className="setup-screen"><LoaderCircle className="spin" /><p>Završavamo bezbednu prijavu…</p></main>;
}
