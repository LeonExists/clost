import React, { useState } from "react";
import { Text, Box, useInput, useApp } from "ink";
import type { CostRecord, TimePeriod } from "../types.js";
import { filterByPeriod, aggregate } from "../aggregator.js";
import { formatCurrency, formatModelName, formatPercent } from "../utils/format.js";
import { BarChart } from "./BarChart.js";
import { TrendChart } from "./TrendChart.js";

interface DashboardProps {
  records: CostRecord[];
}

const PERIODS: TimePeriod[] = ["daily", "weekly", "monthly", "yearly", "all"];
const PERIOD_LABELS: Record<TimePeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  all: "All Time",
};

export function Dashboard({ records }: DashboardProps) {
  const [periodIdx, setPeriodIdx] = useState(0);
  const [showProjects, setShowProjects] = useState(true);
  const [showModels, setShowModels] = useState(true);
  const { exit } = useApp();

  const period = PERIODS[periodIdx];
  const filtered = filterByPeriod(records, period);
  const agg = aggregate(filtered);

  useInput((input, key) => {
    if (input === "q" || key.escape) exit();
    if (key.rightArrow || input === "\t") setPeriodIdx((i) => (i + 1) % PERIODS.length);
    if (key.leftArrow) setPeriodIdx((i) => (i - 1 + PERIODS.length) % PERIODS.length);
    if (input === "p") setShowProjects((v) => !v);
    if (input === "m") setShowModels((v) => !v);
  });

  const periodTabs = PERIODS.map((p, i) => {
    const label = PERIOD_LABELS[p];
    return i === periodIdx ? `[${label}]` : ` ${label} `;
  }).join(" ");

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box justifyContent="space-between">
        <Text bold>clost — Interactive Dashboard</Text>
        <Text dimColor>[q]uit</Text>
      </Box>

      <Text>{"─".repeat(55)}</Text>

      {/* Period selector */}
      <Box marginY={1}>
        <Text>  Period: {periodTabs}</Text>
      </Box>

      {/* Total */}
      <Box marginBottom={1}>
        <Text bold>  Total: </Text>
        <Text bold color="green">{formatCurrency(agg.totalCost)}</Text>
      </Box>

      {/* Model breakdown */}
      {showModels && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold dimColor>  By Model:</Text>
          <BarChart
            rows={Object.entries(agg.byModel).map(([id, value]) => ({
              label: formatModelName(id),
              value,
            }))}
            total={agg.totalCost}
          />
        </Box>
      )}

      {/* Project breakdown */}
      {showProjects && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold dimColor>  By Project:</Text>
          <BarChart
            rows={Object.entries(agg.byProject).map(([label, value]) => ({
              label,
              value,
            }))}
            total={agg.totalCost}
            maxWidth={16}
          />
        </Box>
      )}

      {/* Trend chart */}
      <TrendChart records={records} period={period} />

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>  ← → switch period   p projects   m models   q quit</Text>
      </Box>
    </Box>
  );
}
