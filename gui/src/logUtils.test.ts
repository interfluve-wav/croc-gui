import { describe, expect, it } from "vitest";
import { appendLogLine, LOG_MAX_LINES } from "./logUtils";

describe("appendLogLine", () => {
  it("appends a new line to an empty log", () => {
    expect(appendLogLine([], "hello")).toEqual(["hello"]);
  });

  it("appends distinct lines in order", () => {
    expect(appendLogLine(["a"], "b")).toEqual(["a", "b"]);
  });

  it("collapses a consecutive duplicate into a ×2 suffix", () => {
    expect(appendLogLine(["a", "b"], "b")).toEqual(["a", "b ×2"]);
  });

  it("increments the counter on further duplicates", () => {
    const log = appendLogLine(["a", "b ×2"], "b");
    expect(log).toEqual(["a", "b ×3"]);
    expect(appendLogLine(log, "b")).toEqual(["a", "b ×4"]);
  });

  it("does not collapse non-consecutive duplicates", () => {
    expect(appendLogLine(["a", "b"], "a")).toEqual(["a", "b", "a"]);
  });

  it("starts a fresh line after a different line intervenes", () => {
    const log = appendLogLine(["a ×2", "b"], "a");
    expect(log).toEqual(["a ×2", "b", "a"]);
  });

  it("caps the log at the maximum, dropping oldest lines", () => {
    const full = Array.from({ length: LOG_MAX_LINES }, (_, i) => `line-${i}`);
    const next = appendLogLine(full, "new");
    expect(next).toHaveLength(LOG_MAX_LINES);
    expect(next[0]).toBe("line-1");
    expect(next[next.length - 1]).toBe("new");
  });

  it("respects a custom max", () => {
    const next = appendLogLine(["a", "b", "c"], "d", 3);
    expect(next).toEqual(["b", "c", "d"]);
  });
});
