/**
 * secureStore.js
 * Encrypted client-side storage using the Web Crypto API (AES-GCM).
 * Falls back to plain localStorage if crypto is unavailable.
 *
 * Usage:
 *   import secureStore from "./utils/secureStore";
 *   await secureStore.set("user", { id: 1, role: "ADMIN" });
 *   const user = await secureStore.get("user");
 *   secureStore.remove("user");
 *   secureStore.clear();
 */

const CRYPTO_KEY_NAME = "coms_enc_key";
const STORAGE_PREFIX  = "coms_sec_";

// ── Key management ────────────────────────────────────────────────────────────

async function getOrCreateKey() {
  // Try to load a persisted key from sessionStorage (lives for the tab session)
  const stored = sessionStorage.getItem(CRYPTO_KEY_NAME);
  if (stored) {
    const raw = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  }

  // Generate a new AES-256-GCM key
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

  // Persist the raw key bytes in sessionStorage so it survives page reloads
  // (but NOT across tabs or browser restarts — data becomes unreadable, which is fine)
  const exported = await crypto.subtle.exportKey("raw", key);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  sessionStorage.setItem(CRYPTO_KEY_NAME, b64);

  return key;
}

// ── Encrypt / Decrypt ─────────────────────────────────────────────────────────

async function encrypt(key, plaintext) {
  const iv  = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));

  // Store iv + ciphertext together as base64
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(key, b64) {
  const combined = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv         = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext  = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

// ── Public API ─────────────────────────────────────────────────────────────────

const secureStore = {
  /**
   * Store any JSON-serialisable value, encrypted.
   */
  async set(name, value) {
    try {
      const key       = await getOrCreateKey();
      const plaintext = JSON.stringify(value);
      const encrypted = await encrypt(key, plaintext);
      localStorage.setItem(STORAGE_PREFIX + name, encrypted);
    } catch (err) {
      console.warn("[secureStore] Encryption failed, storing plain:", err);
      localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(value));
    }
  },

  /**
   * Retrieve and decrypt a stored value. Returns null if missing or unreadable.
   */
  async get(name) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + name);
      if (!raw) return null;

      const key       = await getOrCreateKey();
      const plaintext = await decrypt(key, raw);
      return JSON.parse(plaintext);
    } catch (err) {
      console.warn("[secureStore] Decryption failed:", err);
      // Remove corrupted entry
      localStorage.removeItem(STORAGE_PREFIX + name);
      return null;
    }
  },

  /**
   * Remove a single item.
   */
  remove(name) {
    localStorage.removeItem(STORAGE_PREFIX + name);
  },

  /**
   * Clear ALL secureStore entries (leaves other localStorage keys intact).
   */
  clear() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem(CRYPTO_KEY_NAME);
  }
};

export default secureStore;