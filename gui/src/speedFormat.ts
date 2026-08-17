//! Format raw `bytesPerSecond` from croc's `--json` progress events into a
//! human-friendly string like "5.2 MB/s" for the transfer UI.
//!
//! Extracted from `App.tsx` so the formatting can be unit-tested without
//! pulling in the React tree.

export type FormattedSpeed = string | null;

/** Convert raw bytes-per-second into a human-friendly speed string.
 *  Returns `null` for zero/negative/non-finite inputs so the UI keeps the
 *  previous value. */
export function formatSpeed(bytesPerSecond: number): FormattedSpeed {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return null;
  }
  const units = ["B/s", "kB/s", "MB/s", "GB/s"];
  let value = bytesPerSecond;
  let unitIndex = 0;
  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }
  // Croc uses MB/s for most transfers; show one decimal for sub-100
  // values, integers for everything else. Rounding first means 99.999
  // collapses to "100" rather than "100.0".
  const rounded = Math.round(value);
  const formatted =
    unitIndex === 0 || unitIndex === units.length - 1 || rounded >= 100
      ? rounded.toString()
      : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}
