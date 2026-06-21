// Stable anonymous device fingerprint.
// Persisted in localStorage; if cleared, the user is treated as a new device
// (so a fresh allotment of free credits is granted — and abuse is rate-limited
// server-side by IP + per-fingerprint).
//
// The fingerprint is a 64-char hex SHA-256 of:
//   crypto.randomUUID + navigator.userAgent + screen.height/width + tz offset
// We hash so the value can't be reversed into a useful tracking signal beyond
// what we already chose to combine.

const KEY = "jobtailor_fp";

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

let cached: string | null = null;

export async function getFingerprint(): Promise<string> {
  if (cached) return cached;

  const existing = localStorage.getItem(KEY);
  if (existing && /^[a-f0-9]{32,128}$/i.test(existing)) {
    cached = existing;
    return existing;
  }

  const seed = [
    crypto.randomUUID(),
    navigator.userAgent,
    `${screen.width}x${screen.height}`,
    String(new Date().getTimezoneOffset()),
    navigator.language,
  ].join("|");
  const fp = await sha256Hex(seed);
  localStorage.setItem(KEY, fp);
  cached = fp;
  return fp;
}

export function clearFingerprint() {
  localStorage.removeItem(KEY);
  cached = null;
}
