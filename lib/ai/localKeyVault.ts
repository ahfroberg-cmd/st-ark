import type { AiProvider } from "@/lib/ai/types";

const STORAGE_PREFIX = "stark:ai:byok:v1:";
const KDF_ITERATIONS = 210_000;

interface EncryptedVaultBlob {
  v: 1;
  provider: AiProvider;
  ciphertext: string;
  salt: string;
  iv: string;
  createdAt: string;
}

const te = new TextEncoder();
const td = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    te.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations: KDF_ITERATIONS,
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function keyForProvider(provider: AiProvider): string {
  return `${STORAGE_PREFIX}${provider}`;
}

export function hasStoredApiKey(provider: AiProvider): boolean {
  if (typeof window === "undefined") return false;
  return !!window.localStorage.getItem(keyForProvider(provider));
}

export function clearStoredApiKey(provider: AiProvider): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(keyForProvider(provider));
}

export async function storeEncryptedApiKey(params: {
  provider: AiProvider;
  apiKey: string;
  passphrase: string;
}): Promise<void> {
  const { provider, apiKey, passphrase } = params;
  if (!apiKey.trim()) throw new Error("API-nyckel saknas.");
  if (!passphrase.trim()) throw new Error("Lösenfras saknas.");

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveAesKey(passphrase, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    te.encode(apiKey)
  );

  const payload: EncryptedVaultBlob = {
    v: 1,
    provider,
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    salt: toBase64(salt),
    iv: toBase64(iv),
    createdAt: new Date().toISOString(),
  };

  window.localStorage.setItem(keyForProvider(provider), JSON.stringify(payload));
}

export async function unlockApiKey(params: {
  provider: AiProvider;
  passphrase: string;
}): Promise<string> {
  const { provider, passphrase } = params;
  if (!passphrase.trim()) throw new Error("Lösenfras saknas.");

  const raw = window.localStorage.getItem(keyForProvider(provider));
  if (!raw) throw new Error("Ingen sparad API-nyckel för vald provider.");

  let blob: EncryptedVaultBlob;
  try {
    blob = JSON.parse(raw) as EncryptedVaultBlob;
  } catch {
    throw new Error("Kunde inte läsa sparad nyckel.");
  }

  if (!blob || blob.v !== 1) {
    throw new Error("Okänt nyckelformat.");
  }

  const aesKey = await deriveAesKey(passphrase, new Uint8Array(toArrayBuffer(fromBase64(blob.salt))));
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(fromBase64(blob.iv)) },
      aesKey,
      toArrayBuffer(fromBase64(blob.ciphertext))
    );
    return td.decode(plaintext);
  } catch {
    throw new Error("Fel lösenfras eller korrupt nyckeldata.");
  }
}
