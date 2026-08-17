import { describe, expect, it } from "vitest";
import { formatSpeed } from "./speedFormat";

describe("formatSpeed", () => {
  it("returns null for zero", () => {
    expect(formatSpeed(0)).toBeNull();
  });

  it("returns null for negative values", () => {
    expect(formatSpeed(-100)).toBeNull();
  });

  it("returns null for non-finite values", () => {
    expect(formatSpeed(Number.NaN)).toBeNull();
    expect(formatSpeed(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("formats B/s for small values", () => {
    expect(formatSpeed(500)).toBe("500 B/s");
  });

  it("formats kB/s for thousands", () => {
    expect(formatSpeed(2_500)).toBe("2.5 kB/s");
    expect(formatSpeed(99_999)).toBe("100 kB/s");
  });

  it("formats MB/s for millions", () => {
    expect(formatSpeed(5_242_880)).toBe("5.2 MB/s");
    expect(formatSpeed(256_333_767)).toBe("256 MB/s");
  });

  it("formats GB/s for billions", () => {
    expect(formatSpeed(2_500_000_000)).toBe("3 GB/s");
  });
});
