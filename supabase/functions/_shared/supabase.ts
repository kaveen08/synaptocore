import { createClient } from "npm:@supabase/supabase-js@2.110.0";

export function requireEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function keyFromEnvironment(name: string): string | null {
  const serialized = Deno.env.get(name)?.trim();
  if (!serialized) return null;
  const keys = JSON.parse(serialized) as Record<string, string>;
  const value = keys.default ?? Object.values(keys)[0];
  return value || null;
}

function secretKey(): string {
  const current = keyFromEnvironment("SUPABASE_SECRET_KEYS");
  if (current) return current;

  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) return legacy;
  throw new Error("No Supabase secret key is configured.");
}

export function publishableKey(): string {
  const current = keyFromEnvironment("SUPABASE_PUBLISHABLE_KEYS");
  if (current) return current;

  const legacy = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  if (legacy) return legacy;
  throw new Error("No Supabase publishable key is configured.");
}

export function adminClient() {
  return createClient(requireEnvironment("SUPABASE_URL"), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
