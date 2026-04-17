import { beforeEach, describe, expect, it } from "vitest";
import {
  clearStoredApiKey,
  hasStoredApiKey,
  storeEncryptedApiKey,
  unlockApiKey,
} from "@/lib/ai/localKeyVault";

function createLocalStorageMock() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

describe("localKeyVault", () => {
  beforeEach(() => {
    const localStorage = createLocalStorageMock();
    (globalThis as any).window = { localStorage };
  });

  it("stores and unlocks encrypted key", async () => {
    await storeEncryptedApiKey({
      provider: "openai",
      apiKey: "sk-test-123",
      passphrase: "correct horse battery staple",
    });

    expect(hasStoredApiKey("openai")).toBe(true);
    const key = await unlockApiKey({
      provider: "openai",
      passphrase: "correct horse battery staple",
    });
    expect(key).toBe("sk-test-123");
  });

  it("fails unlock with wrong passphrase", async () => {
    await storeEncryptedApiKey({
      provider: "openai",
      apiKey: "sk-secret",
      passphrase: "right-pass",
    });

    await expect(
      unlockApiKey({ provider: "openai", passphrase: "wrong-pass" })
    ).rejects.toThrow(/Fel lösenfras/i);
  });

  it("clears stored key", async () => {
    await storeEncryptedApiKey({
      provider: "gemini",
      apiKey: "g-key",
      passphrase: "pass",
    });
    clearStoredApiKey("gemini");
    expect(hasStoredApiKey("gemini")).toBe(false);
  });
});
