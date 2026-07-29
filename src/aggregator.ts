import {
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
} from "date-fns";
import type { CostRecord, AggregatedCost, TimePeriod } from "./types.js";

export function filterByPeriod(
  records: CostRecord[],
  period: TimePeriod
): CostRecord[] {
  if (period === "all") return records;

  const now = new Date();
  let start: Date;

  switch (period) {
    case "daily":
      start = startOfDay(now);
      break;
    case "weekly":
      start = startOfDay(subDays(now, 7));
      break;
    case "monthly":
      start = startOfMonth(now);
      break;
    case "yearly":
      start = startOfYear(now);
      break;
  }

  return records.filter((r) => r.timestamp >= start);
}

export function aggregate(records: CostRecord[]): AggregatedCost {
  const byProject: Record<string, number> = {};
  const byModel: Record<string, number> = {};
  let totalCost = 0;

  for (const record of records) {
    totalCost += record.cost;

    byProject[record.project] = (byProject[record.project] ?? 0) + record.cost;
    byModel[record.model] = (byModel[record.model] ?? 0) + record.cost;
  }

  return { totalCost, byProject, byModel, records };
}

export function getPeriodSummary(
  records: CostRecord[]
): Record<TimePeriod, number> {
  const periods: TimePeriod[] = ["daily", "weekly", "monthly", "yearly", "all"];
  const summary: Record<string, number> = {};

  for (const period of periods) {
    const filtered = filterByPeriod(records, period);
    summary[period] = filtered.reduce((sum, r) => sum + r.cost, 0);
  }

  return summary as Record<TimePeriod, number>;
}
