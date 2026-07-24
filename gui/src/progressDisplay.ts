export type ProgressSlice = {
  percent: number | null;
  bytesDone: number | null;
  bytesTotal: number | null;
  speed: string | null;
  phase: string | null;
  label: string | null;
};

export type TransferMode = "send" | "receive";

export type ProgressStall = "finishing" | "hint" | null;

export type TransferUiPhase =
  | "preparing"
  | "waiting"
  | "transferring"
  | "finishing";

/** Croc's bar often sticks at 99% while hashing or waiting for relay ack. */
export function isNearComplete(progress: ProgressSlice): boolean {
  if (progress.phase === "finishing") return true;
  if (progress.percent != null && progress.percent >= 98) return true;
  if (
    progress.bytesDone != null &&
    progress.bytesTotal != null &&
    progress.bytesTotal > 0
  ) {
    return progress.bytesDone >= progress.bytesTotal * 0.99;
  }
  return false;
}

export function isBytesComplete(progress: ProgressSlice): boolean {
  if (progress.percent === 100 || progress.percent === 99) return true;
  if (
    progress.bytesDone != null &&
    progress.bytesTotal != null &&
    progress.bytesTotal > 0
  ) {
    return progress.bytesDone >= progress.bytesTotal * 0.99;
  }
  return false;
}

function hasTransferActivity(progress: ProgressSlice): boolean {
  return (
    progress.percent != null ||
    progress.bytesDone != null ||
    progress.speed != null
  );
}

export function getTransferUiPhase(
  progress: ProgressSlice,
  showProgress: boolean,
  stall: ProgressStall,
  running: boolean,
): TransferUiPhase {
  if (stall === "hint" || stall === "finishing" || isNearComplete(progress)) {
    return "finishing";
  }

  const phase = progress.phase ?? "";
  const labelLower = (progress.label ?? "").toLowerCase();

  if (
    phase === "preparing" ||
    phase === "checking" ||
    labelLower.includes("hash")
  ) {
    return "preparing";
  }

  if (
    phase === "waiting" ||
    phase === "connecting" ||
    (running && !hasTransferActivity(progress) && !showProgress)
  ) {
    return "waiting";
  }

  if (!running) return "waiting";

  return "transferring";
}

function getTransferPercentText(
  progress: ProgressSlice,
  computedPercent: number | null,
): string | null {
  if (progress.percent != null) {
    return `${Math.round(progress.percent)}%`;
  }
  if (
    progress.bytesDone != null &&
    progress.bytesTotal != null &&
    progress.bytesTotal > 0
  ) {
    const pct = (progress.bytesDone / progress.bytesTotal) * 100;
    return `${Math.round(pct)}%`;
  }
  if (computedPercent != null) {
    return `${Math.round(computedPercent)}%`;
  }
  return null;
}

/** Single primary status line per moment — matches croc UI phases. */
export function getUnifiedStatusLine(
  progress: ProgressSlice,
  mode: TransferMode,
  uiPhase: TransferUiPhase,
  stall: ProgressStall,
  computedPercent: number | null,
): string {
  if (stall === "hint") {
    return mode === "send"
      ? "Upload complete — waiting for the receiver"
      : "Download complete — verifying files";
  }

  if (uiPhase === "finishing") {
    if (stall === "finishing" || isBytesComplete(progress)) {
      return "Verifying…";
    }
    return "Verifying…";
  }

  switch (uiPhase) {
    case "preparing":
      return mode === "send" ? "Preparing files…" : "Preparing…";
    case "waiting":
      return mode === "send"
        ? "Waiting for receiver — share the code"
        : "Waiting for sender…";
    case "transferring": {
      const pct = getTransferPercentText(progress, computedPercent);
      const verb = mode === "send" ? "Sending" : "Receiving";
      return pct ? `${verb} · ${pct}` : `${verb}…`;
    }
    default:
      return mode === "send" ? "Sending…" : "Receiving…";
  }
}

/** Badge in panel header — avoid showing "99%" during verify/finish. */
export function getProgressBadge(
  progress: ProgressSlice,
  mode: TransferMode,
  stall: ProgressStall,
): string | null {
  if (stall === "hint") {
    return mode === "send" ? "Waiting" : "Verifying";
  }
  if (isNearComplete(progress) || stall === "finishing") {
    return mode === "send" ? "Finishing" : "Verifying";
  }
  if (progress.percent != null) {
    return `${Math.round(progress.percent)}%`;
  }
  if (
    progress.bytesDone != null &&
    progress.bytesTotal != null &&
    progress.bytesTotal > 0
  ) {
    const pct = (progress.bytesDone / progress.bytesTotal) * 100;
    return `${Math.round(pct)}%`;
  }
  return null;
}

/** Bar width: snap to full when data is sent but croc is still wrapping up. */
export function getProgressBarPercent(
  progress: ProgressSlice,
  computedPercent: number | null,
): number | null {
  if (isNearComplete(progress) || isBytesComplete(progress)) {
    return 100;
  }
  return computedPercent;
}

export function getProgressStatus(
  progress: ProgressSlice,
  mode: TransferMode,
  stall: ProgressStall,
  uiPhase?: TransferUiPhase,
  computedPercent?: number | null,
): string {
  const phase =
    uiPhase ??
    getTransferUiPhase(progress, hasTransferActivity(progress), stall, true);
  const pct = computedPercent ?? null;
  return getUnifiedStatusLine(progress, mode, phase, stall, pct);
}

/** Strip croc progressbar noise; keep human file description when useful. */
export function simplifyCrocLabel(label: string): string {
  let s = label.trim();
  const pct = s.search(/\d+\s*%/);
  if (pct > 0) {
    s = s.slice(0, pct).trim();
  }
  s = s.replace(/\|+[█░▓▒■□\s]*\|*/g, "").trim();
  if (/^sending\b/i.test(s)) {
    return "Uploading…";
  }
  if (/^receiv/i.test(s)) {
    return "Downloading…";
  }
  if (/^checking\b/i.test(s)) {
    return "Checking files…";
  }
  return s || "Transferring…";
}

export function parseFileFromCrocLabel(
  label: string | null,
): { name: string; sizeText: string | null } | null {
  if (!label) return null;
  const match = label.match(/['"]([^'"]+)['"]\s*(?:\(([^)]+)\))?/);
  if (!match?.[1]) return null;
  return { name: match[1], sizeText: match[2]?.trim() ?? null };
}

export function getActiveFileBasename(label: string | null): string | null {
  const parsed = parseFileFromCrocLabel(label);
  if (!parsed) return null;
  const parts = parsed.name.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || parsed.name;
}

export function getProgressDetail(
  progress: ProgressSlice,
  mode: TransferMode,
  formatBytes: (n: number) => string,
): string {
  const parts: string[] = [];

  if (isNearComplete(progress) && isBytesComplete(progress)) {
    parts.push(
      mode === "send" ? "All data uploaded" : "All data received",
    );
  } else if (progress.bytesDone != null && progress.bytesTotal != null) {
    parts.push(
      `${formatBytes(progress.bytesDone)} / ${formatBytes(progress.bytesTotal)}`,
    );
  } else if (progress.bytesDone != null) {
    parts.push(formatBytes(progress.bytesDone));
  }

  if (progress.speed && !isNearComplete(progress)) {
    parts.push(progress.speed);
  }

  if (isNearComplete(progress) && !isBytesComplete(progress)) {
    parts.push("wrapping up");
  }

  return parts.join(" · ");
}
