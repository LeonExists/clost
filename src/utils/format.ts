import chalk from "chalk";

export function formatCurrency(amount: number): string {
  return "$" + amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return "0.0%";
  return ((value / total) * 100).toFixed(1) + "%";
}

export function getSpendColor(amount: number, average: number): typeof chalk {
  if (average === 0) return chalk.white;
  const ratio = amount / average;
  if (ratio < 0.8) return chalk.green;
  if (ratio < 1.3) return chalk.yellow;
  return chalk.red;
}

export function formatModelName(modelId: string): string {
  const match = modelId.match(/^claude-(\w+)-(\d+)(?:-(\d+))?/);
  if (!match) return modelId;

  const [, family, major, minor] = match;
  const name = family.charAt(0).toUpperCase() + family.slice(1);

  if (minor && !minor.match(/^\d{8}$/)) {
    return `${name} ${major}.${minor}`;
  }

  return `${name} ${major}`;
}
