export interface UsageData {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface UsageRecord {
  timestamp: string;
  model: string;
  usage: UsageData;
  project: string;
}

export interface PricingEntry {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface DateDependentPricing {
  before: string;
  pricing: PricingEntry;
  after: string;
  pricingAfter: PricingEntry;
}

export type PricingRule = PricingEntry | DateDependentPricing;

export interface PricingTable {
  [modelPattern: string]: PricingRule;
}

export interface CostRecord {
  timestamp: Date;
  model: string;
  project: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

export interface AggregatedCost {
  totalCost: number;
  byProject: Record<string, number>;
  byModel: Record<string, number>;
  records: CostRecord[];
}

export type TimePeriod = "daily" | "weekly" | "monthly" | "yearly" | "all";

export interface CliFlags {
  interactive: boolean;
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
  yearly: boolean;
  all: boolean;
  project: boolean;
  model: boolean;
}
