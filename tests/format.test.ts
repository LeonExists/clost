import { describe, it, expect } from "vitest";
import { formatCurrency, formatPercent, formatModelName } from "../src/utils/format.js";

describe("formatCurrency", () => {
  it("formats dollars with 2 decimal places", () => {
    expect(formatCurrency(12.4)).toBe("$12.40");
  });

  it("adds comma separator for thousands", () => {
    expect(formatCurrency(1247.63)).toBe("$1,247.63");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("handles small amounts", () => {
    expect(formatCurrency(0.003)).toBe("$0.00");
  });
});

describe("formatPercent", () => {
  it("formats percentage with 1 decimal", () => {
    expect(formatPercent(42, 100)).toBe("42.0%");
  });

  it("handles zero total", () => {
    expect(formatPercent(5, 0)).toBe("0.0%");
  });
});

describe("formatModelName", () => {
  it("formats opus model id to readable name", () => {
    expect(formatModelName("claude-opus-5-20250601")).toBe("Opus 5");
  });

  it("formats sonnet model id", () => {
    expect(formatModelName("claude-sonnet-5-20250514")).toBe("Sonnet 5");
  });

  it("formats haiku model id", () => {
    expect(formatModelName("claude-haiku-4-5-20251001")).toBe("Haiku 4.5");
  });

  it("formats opus 4.x model ids", () => {
    expect(formatModelName("claude-opus-4-6")).toBe("Opus 4.6");
  });

  it("formats fable model id", () => {
    expect(formatModelName("claude-fable-5-20260101")).toBe("Fable 5");
  });

  it("returns raw id for unknown formats", () => {
    expect(formatModelName("unknown")).toBe("unknown");
  });
});
