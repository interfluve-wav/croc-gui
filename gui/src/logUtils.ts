/** Maximum number of log lines kept in memory / rendered. */
export const LOG_MAX_LINES = 200;

/** Matches a trailing repeat counter added by `appendLogLine` ("line ×3"). */
const REPEAT_SUFFIX = /^(.*) ×(\d+)$/s;

/**
 * Appends a line to the transfer log, collapsing consecutive duplicates into
 * a single line with a `×N` suffix. croc emits many repeated lines (progress
 * redraws, relay reconnects), so this keeps the log compact and readable.
 *
 * The returned array is capped at `max` lines, dropping the oldest first.
 */
export function appendLogLine(
  prev: readonly string[],
  line: string,
  max: number = LOG_MAX_LINES,
): string[] {
  const last = prev[prev.length - 1];
  if (last !== undefined) {
    const match = REPEAT_SUFFIX.exec(last);
    const base = match ? match[1] : last;
    if (base === line) {
      const count = match ? Number.parseInt(match[2], 10) + 1 : 2;
      return [...prev.slice(0, -1), `${line} ×${count}`];
    }
  }
  return [...prev.slice(-(max - 1)), line];
}
