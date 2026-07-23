export type ProxyProtocol = "socks5" | "http";

const URL_PREFIX = /^(socks5|https?):\/\//i;

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

/** Percent-encode userinfo for proxy URLs (aligned with encodeURIComponent). */
function encodeUserinfo(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Normalize pasted or typed proxy input.
 * - `host:port:username:password` → `scheme://user:pass@host:port`
 * - Existing `socks5://`, `http://`, or `https://` URLs are returned trimmed, unchanged
 * - Empty input → empty string
 */
export function normalizeProxyInput(
  raw: string,
  protocol: ProxyProtocol,
): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (URL_PREFIX.test(trimmed)) {
    return trimmed;
  }

  const parts = trimmed.split(":");
  if (parts.length !== 4) {
    return trimmed;
  }

  const [host, portStr, username, password] = parts;
  if (!host || !portStr || !username || password === undefined) {
    return trimmed;
  }

  const port = Number(portStr);
  if (!isValidPort(port)) {
    return trimmed;
  }

  const scheme = protocol === "socks5" ? "socks5" : "http";
  const user = encodeUserinfo(username);
  const pass = encodeUserinfo(password);
  return `${scheme}://${user}:${pass}@${host}:${port}`;
}

/** Shared paste/blur handler for proxy fields. */
export function applyProxyFieldNormalization(
  value: string,
  protocol: ProxyProtocol,
): string | null {
  const next = normalizeProxyInput(value, protocol);
  return next !== value ? next : null;
}
