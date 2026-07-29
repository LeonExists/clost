import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { filterByPeriod, aggregate, getPeriodSummary } from "../src/aggregator.js";
import type { CostRecord } from "../src/types.js";

const mockRecords: CostRecord[] = [
  {
    timestamp: new Date("2026-07-29T10:00:00Z"),
    model: "claude-opus-5-20250601",
    project: "my-app",
    cost: 5.0,
    inputTokens: 1000,
    outputTokens: 500,
    cacheWriteTokens: 100,
    cacheReadTokens: 200,
  },
  {
    timestamp: new Date("2026-07-29T14:00:00Z"),
    model: "claude-sonnet-5-20250514",
    project: "api-service",
    cost: 2.0,
    inputTokens: 800,
    outputTokens: 400,
    cacheWriteTokens: 50,
    cacheReadTokens: 100,
  },
  {
    timestamp: new Date("2026-07-22T10:00:00Z"),
    model: "claude-opus-5-20250601",
    project: "my-app",
    cost: 8.0,
    inputTokens: 2000,
    outputTokens: 1000,
    cacheWriteTokens: 200,
    cacheReadTokens: 400,
  },
  {
    timestamp: new Date("2026-06-15T10:00:00Z"),
    model: "claude-haiku-4-5-20251001",
    project: "scripts",
    cost: 0.5,
    inputTokens: 500,
    outputTokens: 250,
    cacheWriteTokens: 0,
    cacheReadTokens: 1000,
  },
];

describe("filterByPeriod", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T16:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("filters to today only", () => {
    const result = filterByPeriod(mockRecords, "daily");
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.timestamp >= new Date("2026-07-29T00:00:00Z"))).toBe(true);
  });

  it("filters to this week", () => {
    const result = filterByPeriod(mockRecords, "weekly");
    expect(result).toHaveLength(3);
  });

  it("returns all records for 'all' period", () => {
    const result = filterByPeriod(mockRecords, "all");
    expect(result).toHaveLength(4);
  });
});

describe("aggregate", () => {
  it("aggregates total cost", () => {
    const result = aggregate(mockRecords);
    expect(result.totalCost).toBeCloseTo(15.5);
  });

  it("aggregates by project", () => {
    const result = aggregate(mockRecords);
    expect(result.byProject["my-app"]).toBeCloseTo(13.0);
    expect(result.byProject["api-service"]).toBeCloseTo(2.0);
    expect(result.byProject["scripts"]).toBeCloseTo(0.5);
  });

  it("aggregates by model", () => {
    const result = aggregate(mockRecords);
    expect(result.byModel["claude-opus-5-20250601"]).toBeCloseTo(13.0);
    expect(result.byModel["claude-sonnet-5-20250514"]).toBeCloseTo(2.0);
  });
});
