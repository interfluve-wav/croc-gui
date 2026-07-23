/** Official croc web receiver — scan QR or share link to receive in a browser. */
export const GETCROC_RECEIVE_BASE = "https://getcroc.com/";
/** Must match getcroc.com config.js — required for web send → app receive. */
export const GETCROC_RELAY = "croc.schollz.com:9009";
export const GETCROC_RELAY_PASS = "pass123";

export type ParsedReceiveInput = {
  code: string;
  relay?: string;
  relayPass?: string;
};

function stripQuotes(value: string): string {
  return value.replace(/^['"]+|['"]+$/g, "");
}

function codeFromPlainText(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  const firstLine = s.split(/\r?\n/).find((line) => line.trim()) ?? s;
  s = firstLine.trim();
  const crocCmd = s.match(/^croc\s+(.+)$/i);
  if (crocCmd?.[1]) {
    s = crocCmd[1].trim();
  }
  const envSecret = s.match(
    /^CROC_SECRET=(?:'([^']*)'|"([^"]*)"|(\S+))/i,
  );
  if (envSecret) {
    return stripQuotes(envSecret[1] ?? envSecret[2] ?? envSecret[3] ?? "");
  }
  const token = s.split(/\s+/).find((t) => t.length > 0);
  return stripQuotes(token ?? s);
}

function toGetcrocUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/getcroc\.com/i.test(trimmed)) {
    return trimmed.startsWith("//")
      ? `https:${trimmed}`
      : `https://${trimmed.replace(/^\/+/, "")}`;
  }
  if (/^[?&]/.test(trimmed) || /(?:^|[?&])code=/i.test(trimmed)) {
    const query = trimmed.startsWith("?") ? trimmed : `?${trimmed}`;
    return `${GETCROC_RECEIVE_BASE}${query}`;
  }
  return null;
}

/** Parse pasted receive input: plain code, CLI, or getcroc.com link. */
export function parseReceiveInput(raw: string): ParsedReceiveInput | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const urlCandidate = toGetcrocUrl(trimmed);
  if (urlCandidate) {
    try {
      const url = new URL(urlCandidate);
      const code = url.searchParams.get("code")?.trim();
      if (code) {
        const parsed: ParsedReceiveInput = { code: codeFromPlainText(code) };
        const relay = url.searchParams.get("relay")?.trim();
        const relayPass = url.searchParams.get("pass")?.trim();
        if (relay) parsed.relay = relay;
        if (relayPass) parsed.relayPass = relayPass;
        return parsed.code ? parsed : null;
      }
    } catch {
      /* fall through to plain-text parsing */
    }
  }

  const code = codeFromPlainText(trimmed);
  return code ? { code } : null;
}

/** Normalize pasted/dropped text into a croc code phrase. */
export function normalizeCodePhrase(raw: string): string {
  return sanitizeCodePhrase(raw)?.code ?? "";
}

/** Lowercase ASCII code phrase; rejects characters croc cannot use. */
export function sanitizeCodePhrase(
  raw: string,
): { code: string; changed: boolean } | null {
  const parsed = parseReceiveInput(raw);
  if (!parsed?.code) return null;
  const cleaned = parsed.code.replace(/[^a-zA-Z0-9-]/g, "");
  const code = cleaned.toLowerCase();
  if (code.length < 4) return null;
  const changed =
    cleaned !== parsed.code.trim() || /[A-Z]/.test(cleaned);
  return { code, changed };
}

export function relayHandshakeErrorMessage(line: string): string | null {
  const lower = line.toLowerCase();
  if (
    lower.includes("problem with decoding") ||
    lower.includes("password mismatch") ||
    lower.includes("ips unmarshal error")
  ) {
    return "Could not connect to the croc relay — relay password or address may not match the sender. For getcroc.com, leave Relay and Relay password blank in Options (uses pass123 on croc.schollz.com:9009).";
  }
  return null;
}

export type ShareLinkOptions = {
  relay?: string;
  relayPass?: string;
};

/** Build a getcroc.com URL that opens Receive with the code pre-filled. */
export function buildReceiveUrl(
  phrase: string,
  options: ShareLinkOptions = {},
): string {
  const params = new URLSearchParams();
  params.set("code", phrase.trim());
  const relay = options.relay?.trim();
  if (relay) {
    params.set("relay", relay);
  }
  const relayPass = options.relayPass?.trim();
  if (relayPass) {
    params.set("pass", relayPass);
  }
  return `${GETCROC_RECEIVE_BASE}?${params.toString()}`;
}

export type CliReceiveOptions = ShareLinkOptions & {
  local?: boolean;
};

/** Full `croc` CLI command for terminal receivers (croc v10+ secure mode). */
export function buildCliReceiveCommand(
  phrase: string,
  options: CliReceiveOptions = {},
): string {
  const parts = ["croc"];
  if (options.local) {
    parts.push("--local");
  }
  const relayPass = options.relayPass?.trim();
  if (relayPass) {
    parts.push("--pass", quoteCliArg(relayPass));
  }
  const relay = options.relay?.trim();
  if (relay) {
    parts.push("--relay", quoteCliArg(relay));
  }
  parts.push("--yes");
  return `CROC_SECRET=${shellSingleQuote(phrase.trim())} ${parts.join(" ")}`;
}

function quoteCliArg(value: string): string {
  if (/^[A-Za-z0-9._:@-]+$/.test(value)) {
    return value;
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
