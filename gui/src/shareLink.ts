/** Official croc web receiver — scan QR or share link to receive in a browser. */
export const GETCROC_RECEIVE_BASE = "https://getcroc.com/";

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

/** Full `croc` CLI command for terminal receivers (respects relay / local options). */
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
  parts.push(quoteCliArg(phrase.trim()));
  return parts.join(" ");
}

function quoteCliArg(value: string): string {
  if (/^[A-Za-z0-9._:@-]+$/.test(value)) {
    return value;
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
