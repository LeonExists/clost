import React from "react";
import { Text, Box } from "ink";
import { formatCurrency, formatPercent } from "../utils/format.js";

interface TableRow {
  label: string;
  cost: number;
}

interface TableProps {
  title: string;
  totalCost: number;
  rows: TableRow[];
  header: string;
}

export function Table({ title, totalCost, rows, header }: TableProps) {
  const sorted = [...rows].sort((a, b) => b.cost - a.cost);
  const maxLabelLen = Math.max(...sorted.map((r) => r.label.length), header.length);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>
        {"  "}{title} — {formatCurrency(totalCost)}
      </Text>
      <Text>{""}</Text>
      <Text dimColor>
        {"  "}{header.padEnd(maxLabelLen + 4)}{"Cost".padStart(10)}{"".padStart(4)}%
      </Text>
      <Text dimColor>{"  "}{"─".repeat(maxLabelLen + 24)}</Text>
      {sorted.map((row) => (
        <Text key={row.label}>
          {"  "}{row.label.padEnd(maxLabelLen + 4)}
          {formatCurrency(row.cost).padStart(10)}
          {"    "}{formatPercent(row.cost, totalCost).padStart(6)}
        </Text>
      ))}
    </Box>
  );
}
