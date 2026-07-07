import { createClient } from "npm:@supabase/supabase-js@2.110.0";

export function requireEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function secretKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) return legacy;

  const keys = JSON.parse(requireEnvironment("SUPABASE_SECRET_KEYS")) as Record<
    string,
    string
  >;
  const value = keys.default ?? Object.values(keys)[0];
  if (!value) throw new Error("No Supabase secret key is configured.");
  return value;
}

export function adminClient() {
  return createClient(requireEnvironment("SUPABASE_URL"), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
