"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return router.replace("/login");
    void supabase.auth.getSession().then(({ data }) => {
      router.replace(data.session ? params.get("next") ?? "/" : "/login?error=link");
    });
  }, [params, router]);
  return <main className="setup-screen"><LoaderCircle className="spin" /><p>Završavamo bezbednu prijavu…</p></main>;
}
