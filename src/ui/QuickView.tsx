import React from "react";
import { Text, Box } from "ink";
import type { CostRecord, TimePeriod, CliFlags } from "../types.js";
import { aggregate, filterByPeriod, getPeriodSummary } from "../aggregator.js";
import { formatCurrency, formatModelName } from "../utils/format.js";
import { Table } from "./Table.js";
import { BarChart } from "./BarChart.js";

interface QuickViewProps {
  records: CostRecord[];
  flags: CliFlags;
}

function SummaryCard({ records }: { records: CostRecord[] }) {
  const summary = getPeriodSummary(records);
  const allAgg = aggregate(records);
  const todayAgg = aggregate(filterByPeriod(records, "daily"));

  const topProject = Object.entries(allAgg.byProject).sort(([, a], [, b]) => b - a)[0];
  const topModel = Object.entries(allAgg.byModel).sort(([, a], [, b]) => b - a)[0];

  return (
    <Box flexDirection="column">
      <Text>┌─────────────────────────────────────────┐</Text>
      <Text>│  <Text bold>clost</Text> — Claude Code Costs             │</Text>
      <Text>├─────────────────────────────────────────┤</Text>
      <Text>│  Today        {formatCurrency(summary.daily).padEnd(26)}│</Text>
      <Text>│  This Week    {formatCurrency(summary.weekly).padEnd(26)}│</Text>
      <Text>│  This Month   {formatCurrency(summary.monthly).padEnd(26)}│</Text>
      <Text>│  All Time     {formatCurrency(summary.all).padEnd(26)}│</Text>
      <Text>├─────────────────────────────────────────┤</Text>
      <Text>│  Top Project: {(topProject ? `${topProject[0]} (${formatCurrency(topProject[1])})` : "none").padEnd(26)}│</Text>
      <Text>│  Top Model:   {(topModel ? `${formatModelName(topModel[0])} (${formatCurrency(topModel[1])})` : "none").padEnd(26)}│</Text>
      <Text>└─────────────────────────────────────────┘</Text>
    </Box>
  );
}

export function QuickView({ records, flags }: QuickViewProps) {
  const activePeriod: TimePeriod = flags.daily
    ? "daily"
    : flags.weekly
      ? "weekly"
      : flags.monthly
        ? "monthly"
        : flags.yearly
          ? "yearly"
          : flags.all
            ? "all"
            : "all";

  const hasTimePeriodFlag = flags.daily || flags.weekly || flags.monthly || flags.yearly || flags.all;
  const hasBreakdownFlag = flags.project || flags.model;

  // Default: show summary card
  if (!hasTimePeriodFlag && !hasBreakdownFlag) {
    return <SummaryCard records={records} />;
  }

  const filtered = filterByPeriod(records, activePeriod);
  const agg = aggregate(filtered);

  const periodLabel =
    activePeriod === "daily" ? "Today" :
    activePeriod === "weekly" ? "This Week" :
    activePeriod === "monthly" ? "This Month" :
    activePeriod === "yearly" ? "This Year" : "All Time";

  return (
    <Box flexDirection="column">
      {flags.project && (
        <Table
          title={periodLabel}
          totalCost={agg.totalCost}
          rows={Object.entries(agg.byProject).map(([label, cost]) => ({ label, cost }))}
          header="Project"
        />
      )}
      {flags.model && (
        <Table
          title={flags.project ? "" : periodLabel}
          totalCost={agg.totalCost}
          rows={Object.entries(agg.byModel).map(([id, cost]) => ({
            label: formatModelName(id),
            cost,
          }))}
          header="Model"
        />
      )}
      {!flags.project && !flags.model && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>  {periodLabel} — {formatCurrency(agg.totalCost)}</Text>
          <Box marginTop={1}>
            <BarChart
              rows={Object.entries(agg.byModel).map(([id, value]) => ({
                label: formatModelName(id),
                value,
              }))}
              total={agg.totalCost}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
