import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.0";

import { requireEnvironment } from "./supabase.ts";

export type MailboxCredentials = {
  host: string;
  port: number;
  username: string;
  password: string;
};

type MailboxRow = {
  host: string;
  port: number;
  username: string;
  encrypted_password: string;
  password_iv: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey(): Promise<CryptoKey> {
  const keyBytes = base64ToBytes(requireEnvironment("MAILBOX_CREDENTIALS_KEY"));
  if (keyBytes.length !== 32) {
    throw new Error("MAILBOX_CREDENTIALS_KEY must contain exactly 32 bytes.");
  }
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptMailboxPassword(
  password: string,
): Promise<{ encryptedPassword: string; passwordIv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(password),
  );
  return {
    encryptedPassword: bytesToBase64(new Uint8Array(encrypted)),
    passwordIv: bytesToBase64(iv),
  };
}

async function decryptMailboxPassword(
  encryptedPassword: string,
  passwordIv: string,
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(passwordIv) },
    await encryptionKey(),
    base64ToBytes(encryptedPassword),
  );
  return new TextDecoder().decode(decrypted);
}

export async function loadMailboxCredentials(
  supabase: SupabaseClient,
): Promise<MailboxCredentials> {
  const { data, error } = await supabase
    .from("mailbox_connections")
    .select("host,port,username,encrypted_password,password_iv")
    .eq("singleton", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Swizzonic mailbox is not connected.");

  const row = data as MailboxRow;
  return {
    host: row.host,
    port: row.port,
    username: row.username,
    password: await decryptMailboxPassword(
      row.encrypted_password,
      row.password_iv,
    ),
  };
}
