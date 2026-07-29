import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type {
  PricingTable,
  PricingEntry,
  PricingRule,
  DateDependentPricing,
  UsageRecord,
  CostRecord,
} from "./types.js";

const defaultPricingPath = new URL("../defaults/pricing.json", import.meta.url);
const userPricingPath = join(homedir(), ".clost", "pricing.json");

let pricingTable: PricingTable | null = null;
const warnedModels = new Set<string>();

function isDateDependent(rule: PricingRule): rule is DateDependentPricing {
  return "before" in rule && "pricingAfter" in rule;
}

export function loadPricing(): PricingTable {
  if (pricingTable) return pricingTable;

  const defaults: PricingTable = JSON.parse(
    readFileSync(defaultPricingPath, "utf-8")
  );

  if (existsSync(userPricingPath)) {
    const overrides: PricingTable = JSON.parse(
      readFileSync(userPricingPath, "utf-8")
    );
    pricingTable = { ...defaults, ...overrides };
  } else {
    pricingTable = defaults;
  }

  return pricingTable;
}

export function matchModel(modelId: string): string | null {
  const table = loadPricing();
  const patterns = Object.keys(table);

  // Sort by specificity (longer patterns first)
  patterns.sort((a, b) => b.length - a.length);

  for (const pattern of patterns) {
    if (modelId.startsWith(pattern)) {
      return pattern;
    }
  }

  return null;
}

export function resolvePricing(pattern: string, timestamp: string): PricingEntry {
  const table = loadPricing();
  const rule = table[pattern];

  if (!rule) {
    return { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  }

  if (isDateDependent(rule)) {
    const date = new Date(timestamp);
    const cutoff = new Date(rule.before);
    return date < cutoff ? rule.pricing : rule.pricingAfter;
  }

  return rule as PricingEntry;
}

export function calculateCost(record: UsageRecord): CostRecord {
  const pattern = matchModel(record.model);

  if (!pattern) {
    if (!warnedModels.has(record.model)) {
      warnedModels.add(record.model);
      console.warn(
        `Unknown model: ${record.model} — cost set to $0. Add it to ~/.clost/pricing.json`
      );
    }
    return {
      timestamp: new Date(record.timestamp),
      model: record.model,
      project: record.project,
      cost: 0,
      inputTokens: record.usage.input_tokens,
      outputTokens: record.usage.output_tokens,
      cacheWriteTokens: record.usage.cache_creation_input_tokens,
      cacheReadTokens: record.usage.cache_read_input_tokens,
    };
  }

  const pricing = resolvePricing(pattern, record.timestamp);

  const cost =
    (record.usage.input_tokens * pricing.input) / 1_000_000 +
    (record.usage.output_tokens * pricing.output) / 1_000_000 +
    (record.usage.cache_creation_input_tokens * pricing.cacheWrite) / 1_000_000 +
    (record.usage.cache_read_input_tokens * pricing.cacheRead) / 1_000_000;

  return {
    timestamp: new Date(record.timestamp),
    model: record.model,
    project: record.project,
    cost,
    inputTokens: record.usage.input_tokens,
    outputTokens: record.usage.output_tokens,
    cacheWriteTokens: record.usage.cache_creation_input_tokens,
    cacheReadTokens: record.usage.cache_read_input_tokens,
  };
}

export function calculateAllCosts(records: UsageRecord[]): CostRecord[] {
  return records.map(calculateCost);
}
