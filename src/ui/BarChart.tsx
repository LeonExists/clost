import React from "react";
import { Text, Box } from "ink";
import chalk from "chalk";
import { formatCurrency, formatPercent } from "../utils/format.js";

interface BarChartRow {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  rows: BarChartRow[];
  total: number;
  maxWidth?: number;
}

const COLORS = [chalk.cyan, chalk.magenta, chalk.yellow, chalk.green, chalk.blue, chalk.red];

export function BarChart({ rows, total, maxWidth = 20 }: BarChartProps) {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const maxValue = sorted[0]?.value ?? 0;
  const maxLabelLen = Math.max(...sorted.map((r) => r.label.length));

  return (
    <Box flexDirection="column">
      {sorted.map((row, i) => {
        const barLen = maxValue > 0 ? Math.round((row.value / maxValue) * maxWidth) : 0;
        const colorFn = COLORS[i % COLORS.length];
        const bar = colorFn("█".repeat(barLen)) + "░".repeat(maxWidth - barLen);

        return (
          <Text key={row.label}>
            {"  "}{row.label.padEnd(maxLabelLen + 2)}{bar}{"  "}
            {formatCurrency(row.value).padStart(9)}{"  "}
            ({formatPercent(row.value, total)})
          </Text>
        );
      })}
    </Box>
  );
}
