import { describe, it, expect } from "vitest";
import { matchModel, resolvePricing, calculateCost } from "../src/pricing.js";
import type { UsageRecord, PricingEntry } from "../src/types.js";

describe("matchModel", () => {
  it("matches opus-4-6 to claude-opus-4 pattern", () => {
    expect(matchModel("claude-opus-4-6")).toBe("claude-opus-4");
  });

  it("matches opus-5-20250601 to claude-opus-5 pattern", () => {
    expect(matchModel("claude-opus-5-20250601")).toBe("claude-opus-5");
  });

  it("matches sonnet-5-20250514 to claude-sonnet-5 pattern", () => {
    expect(matchModel("claude-sonnet-5-20250514")).toBe("claude-sonnet-5");
  });

  it("matches haiku-4-5-20251001 to claude-haiku-4 pattern", () => {
    expect(matchModel("claude-haiku-4-5-20251001")).toBe("claude-haiku-4");
  });

  it("returns null for unknown models", () => {
    expect(matchModel("gpt-4")).toBeNull();
  });
});

describe("resolvePricing", () => {
  it("returns intro pricing for sonnet-5 before Sep 2025", () => {
    const pricing = resolvePricing("claude-sonnet-5", "2025-08-15T00:00:00Z");
    expect(pricing.input).toBe(2);
    expect(pricing.output).toBe(10);
  });

  it("returns full pricing for sonnet-5 after Sep 2025", () => {
    const pricing = resolvePricing("claude-sonnet-5", "2025-09-15T00:00:00Z");
    expect(pricing.input).toBe(3);
    expect(pricing.output).toBe(15);
  });

  it("returns standard pricing for non-date-dependent models", () => {
    const pricing = resolvePricing("claude-opus-5", "2026-01-01T00:00:00Z");
    expect(pricing.input).toBe(5);
    expect(pricing.output).toBe(25);
  });
});

describe("calculateCost", () => {
  it("calculates cost correctly for opus", () => {
    const record: UsageRecord = {
      timestamp: "2026-07-28T22:07:29.711Z",
      model: "claude-opus-5-20250601",
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 5000,
      },
      project: "test",
    };

    const cost = calculateCost(record);
    // input: 1000 * 5 / 1_000_000 = 0.005
    // output: 500 * 25 / 1_000_000 = 0.0125
    // cacheWrite: 200 * 6.25 / 1_000_000 = 0.00125
    // cacheRead: 5000 * 0.5 / 1_000_000 = 0.0025
    expect(cost.cost).toBeCloseTo(0.02125);
  });

  it("returns 0 cost for unknown models", () => {
    const record: UsageRecord = {
      timestamp: "2026-07-28T22:07:29.711Z",
      model: "unknown-model",
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      project: "test",
    };

    const cost = calculateCost(record);
    expect(cost.cost).toBe(0);
  });
});
