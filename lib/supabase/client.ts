import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured =
  Boolean(url && anonKey) &&
  !url.includes("your-project") &&
  anonKey !== "your-anon-key";

let browserClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });
  }
  return browserClient;
}

export const phoneAuthEnabled =
  process.env.NEXT_PUBLIC_ENABLE_PHONE_AUTH === "true";

export async function requestPhoneOtp(phone: string) {
  if (!phoneAuthEnabled) {
    return { error: new Error("Phone OTP is disabled until an SMS provider is configured.") };
  }
  const client = getSupabase();
  if (!client) return { error: new Error("Supabase is not configured.") };
  return client.auth.signInWithOtp({ phone });
}
