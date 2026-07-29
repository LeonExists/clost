import React from "react";
import { Text, Box } from "ink";
import {
  startOfDay,
  subDays,
  subWeeks,
  subMonths,
  format,
  isAfter,
  isBefore,
  addDays,
  addWeeks,
  addMonths,
} from "date-fns";
import type { CostRecord, TimePeriod } from "../types.js";
import { formatCurrency } from "../utils/format.js";

interface TrendChartProps {
  records: CostRecord[];
  period: TimePeriod;
}

interface Bucket {
  label: string;
  cost: number;
}

function bucketize(records: CostRecord[], period: TimePeriod): Bucket[] {
  const now = new Date();
  const buckets: Bucket[] = [];

  if (period === "daily" || period === "weekly") {
    // Show last 7 days
    for (let i = 6; i >= 0; i--) {
      const day = startOfDay(subDays(now, i));
      const nextDay = addDays(day, 1);
      const cost = records
        .filter((r) => isAfter(r.timestamp, day) && isBefore(r.timestamp, nextDay))
        .reduce((sum, r) => sum + r.cost, 0);
      buckets.push({ label: format(day, "EEE"), cost });
    }
  } else if (period === "monthly") {
    // Show last 4 weeks
    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfDay(subWeeks(now, i));
      const weekEnd = addWeeks(weekStart, 1);
      const cost = records
        .filter((r) => isAfter(r.timestamp, weekStart) && isBefore(r.timestamp, weekEnd))
        .reduce((sum, r) => sum + r.cost, 0);
      buckets.push({ label: `W${4 - i}`, cost });
    }
  } else {
    // Show last 6 months
    for (let i = 5; i >= 0; i--) {
      const monthStart = subMonths(startOfDay(now), i);
      const monthEnd = addMonths(monthStart, 1);
      const cost = records
        .filter((r) => isAfter(r.timestamp, monthStart) && isBefore(r.timestamp, monthEnd))
        .reduce((sum, r) => sum + r.cost, 0);
      buckets.push({ label: format(monthStart, "MMM"), cost });
    }
  }

  return buckets;
}

export function TrendChart({ records, period }: TrendChartProps) {
  const buckets = bucketize(records, period);
  const maxCost = Math.max(...buckets.map((b) => b.cost), 0.01);
  const chartHeight = 5;

  const rows: string[][] = [];
  for (let row = chartHeight; row >= 1; row--) {
    const threshold = (row / chartHeight) * maxCost;
    const cells = buckets.map((b) => (b.cost >= threshold ? "█" : " "));
    const label = row === chartHeight ? formatCurrency(maxCost).padStart(8) : "        ";
    rows.push([label, ...cells]);
  }

  return (
    <Box flexDirection="column">
      <Text bold dimColor>  ┌─ Trend ─────────────────────────┐</Text>
      {rows.map((row, i) => (
        <Text key={i}>
          {"  │ "}{row[0]}{"  "}{row.slice(1).map((c) => ` ${c} `).join("")}{"  │"}
        </Text>
      ))}
      <Text>
        {"  │         "}{buckets.map((b) => b.label.padStart(3)).join(" ")}{"  │"}
      </Text>
      <Text dimColor>  └─────────────────────────────────┘</Text>
    </Box>
  );
}
