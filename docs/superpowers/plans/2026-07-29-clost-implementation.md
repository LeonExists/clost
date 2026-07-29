# clost Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CLI/TUI tool that calculates Claude Code costs from local session JSONL files, with quick-print and interactive dashboard modes.

**Architecture:** Monolithic single-pass parser reads all `~/.claude/projects/**/*.jsonl` files, applies per-model pricing with date-dependent rules, and aggregates by time period/project/model. Ink renders both quick output and full-screen TUI.

**Tech Stack:** TypeScript, Ink (React for CLI), meow, date-fns, chalk, vitest

## Global Constraints

- Node.js >= 18 (matches Claude Code's requirement)
- ESM-only (`"type": "module"` in package.json)
- Zero required config — must work with just `npx clost`
- All prices in USD per 1M tokens
- Sonnet 5 uses intro pricing ($2/$10) for messages before 2025-09-01, full pricing ($3/$15) from 2025-09-01 onward
- Unknown models get $0 cost with a one-time warning
- Cross-platform paths: support both `~/.claude` (Unix) and `%USERPROFILE%/.claude` (Windows)

---

### Task 1: Project Scaffolding & Types

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/types.ts`
- Create: `bin/clost.js`
- Create: `defaults/pricing.json`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: All shared types used by every other task — `UsageRecord`, `PricingEntry`, `PricingTable`, `CostRecord`, `AggregatedCost`, `TimeFilter`, `CliFlags`

- [ ] **Step 1: Initialize project**

```bash
cd clost
npm init -y
```

Then replace `package.json` with:

```json
{
  "name": "clost",
  "version": "0.1.0",
  "description": "Calculate your Claude Code costs from local session data",
  "type": "module",
  "bin": {
    "clost": "./bin/clost.js"
  },
  "main": "./dist/index.js",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": ["claude", "cost", "cli", "tui", "anthropic", "claude-code"],
  "license": "MIT",
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install ink react meow chalk date-fns
npm install -D typescript tsx vitest @types/react @types/node
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create src/types.ts**

```typescript
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
```

- [ ] **Step 5: Create defaults/pricing.json**

```json
{
  "claude-fable-5": {
    "input": 10,
    "output": 50,
    "cacheWrite": 12.5,
    "cacheRead": 1.0
  },
  "claude-mythos-5": {
    "input": 10,
    "output": 50,
    "cacheWrite": 12.5,
    "cacheRead": 1.0
  },
  "claude-opus-5": {
    "input": 5,
    "output": 25,
    "cacheWrite": 6.25,
    "cacheRead": 0.5
  },
  "claude-opus-4": {
    "input": 5,
    "output": 25,
    "cacheWrite": 6.25,
    "cacheRead": 0.5
  },
  "claude-sonnet-5": {
    "before": "2025-09-01",
    "pricing": {
      "input": 2,
      "output": 10,
      "cacheWrite": 2.5,
      "cacheRead": 0.2
    },
    "after": "2025-09-01",
    "pricingAfter": {
      "input": 3,
      "output": 15,
      "cacheWrite": 3.75,
      "cacheRead": 0.3
    }
  },
  "claude-sonnet-4": {
    "input": 3,
    "output": 15,
    "cacheWrite": 3.75,
    "cacheRead": 0.3
  },
  "claude-haiku-4": {
    "input": 1,
    "output": 5,
    "cacheWrite": 1.25,
    "cacheRead": 0.1
  }
}
```

- [ ] **Step 6: Create bin/clost.js**

```javascript
#!/usr/bin/env node
import('../dist/index.js');
```

- [ ] **Step 7: Verify project compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (types.ts should compile cleanly)

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold clost project with types and pricing defaults"
```

---

### Task 2: Path Utilities & Parser

**Files:**
- Create: `src/utils/paths.ts`
- Create: `src/parser.ts`
- Create: `tests/paths.test.ts`
- Create: `tests/parser.test.ts`

**Interfaces:**
- Consumes: `UsageRecord`, `UsageData` from `src/types.ts`
- Produces: `getClaudeDir(): string`, `getProjectDirs(): string[]`, `extractProjectName(dirName: string): string`, `parseSessionFiles(): UsageRecord[]`

- [ ] **Step 1: Write tests for path utilities**

Create `tests/paths.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractProjectName } from "../src/utils/paths.js";

describe("extractProjectName", () => {
  it("extracts last meaningful segment from encoded path", () => {
    const encoded = "C--Users-LSzameitat-OneDrive---CTS-Eventim-Group-Desktop-Workspace-03-Code-Projects-LOCKED-IN-PROJECTS";
    expect(extractProjectName(encoded)).toBe("LOCKED IN PROJECTS");
  });

  it("handles simple project names", () => {
    const encoded = "C--Users-someone-projects-my-app";
    expect(extractProjectName(encoded)).toBe("my-app");
  });

  it("handles paths with worktree suffixes", () => {
    const encoded = "C--Users-LSzameitat-projects-my-app--claude-worktrees-feature-branch";
    expect(extractProjectName(encoded)).toBe("my-app");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/paths.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement path utilities**

Create `src/utils/paths.ts`:

```typescript
import { homedir } from "node:os";
import { join } from "node:path";
import { readdirSync, existsSync } from "node:fs";

export function getClaudeDir(): string {
  return join(homedir(), ".claude");
}

export function getProjectDirs(): string[] {
  const projectsDir = join(getClaudeDir(), "projects");
  if (!existsSync(projectsDir)) return [];

  return readdirSync(projectsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(projectsDir, d.name));
}

export function extractProjectName(dirName: string): string {
  // Remove worktree suffixes (--claude-worktrees-*)
  const withoutWorktree = dirName.replace(/--claude-worktrees-.*$/, "");

  // Split by the path separator pattern: single dash between segments,
  // double dash is the drive separator (C--)
  // Strategy: split on "C--" prefix, take the path, split by single "-"
  // Actually the encoding is: / becomes -, space becomes -, -- means literal -
  // The last segment after the last known directory separator is the project name

  // Heuristic: take everything after the last recognizable parent directory pattern
  // Common patterns: Desktop-, projects-, Code-Projects-, Workspace-
  const segments = withoutWorktree.split("-");

  // Find the last meaningful segment by looking for common parent dirs
  // and taking everything after them
  const parentMarkers = ["Desktop", "Projects", "Workspace", "projects", "repos", "code", "src"];

  let lastMarkerIdx = -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (parentMarkers.includes(segments[i])) {
      lastMarkerIdx = i;
      break;
    }
  }

  if (lastMarkerIdx >= 0 && lastMarkerIdx < segments.length - 1) {
    return segments.slice(lastMarkerIdx + 1).join(" ").replace(/\s+/g, " ").trim();
  }

  // Fallback: take the last segment(s) — split from the last double-dash or use last 2-3 segments
  const lastDoubleDash = withoutWorktree.lastIndexOf("---");
  if (lastDoubleDash > 0) {
    return withoutWorktree.slice(lastDoubleDash + 3).replace(/-/g, " ").trim();
  }

  // Final fallback: last 3 segments joined
  return segments.slice(-3).join(" ").trim();
}

export function getSessionFiles(): string[] {
  const projectDirs = getProjectDirs();
  const files: string[] = [];

  for (const dir of projectDirs) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        files.push(join(dir, entry.name));
      }
    }
  }

  return files;
}
```

- [ ] **Step 4: Run path tests**

```bash
npx vitest run tests/paths.test.ts
```

Expected: PASS

- [ ] **Step 5: Write tests for parser**

Create `tests/parser.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseJsonlLine } from "../src/parser.js";

describe("parseJsonlLine", () => {
  it("extracts usage record from a valid message line", () => {
    const line = JSON.stringify({
      type: "assistant",
      timestamp: "2026-07-28T22:07:29.711Z",
      model: "claude-opus-4-6",
      usage: {
        input_tokens: 100,
        output_tokens: 200,
        cache_creation_input_tokens: 50,
        cache_read_input_tokens: 300,
      },
    });

    const result = parseJsonlLine(line);
    expect(result).toEqual({
      timestamp: "2026-07-28T22:07:29.711Z",
      model: "claude-opus-4-6",
      usage: {
        input_tokens: 100,
        output_tokens: 200,
        cache_creation_input_tokens: 50,
        cache_read_input_tokens: 300,
      },
      project: "",
    });
  });

  it("returns null for lines without usage data", () => {
    const line = JSON.stringify({
      type: "user",
      timestamp: "2026-07-28T22:07:29.711Z",
    });
    expect(parseJsonlLine(line)).toBeNull();
  });

  it("returns null for lines without a model", () => {
    const line = JSON.stringify({
      type: "assistant",
      timestamp: "2026-07-28T22:07:29.711Z",
      usage: { input_tokens: 100, output_tokens: 200 },
    });
    expect(parseJsonlLine(line)).toBeNull();
  });

  it("defaults missing cache fields to 0", () => {
    const line = JSON.stringify({
      type: "assistant",
      timestamp: "2026-07-28T22:07:29.711Z",
      model: "claude-sonnet-5-20250514",
      usage: {
        input_tokens: 10,
        output_tokens: 50,
      },
    });

    const result = parseJsonlLine(line);
    expect(result!.usage.cache_creation_input_tokens).toBe(0);
    expect(result!.usage.cache_read_input_tokens).toBe(0);
  });
});
```

- [ ] **Step 6: Run parser tests to verify they fail**

```bash
npx vitest run tests/parser.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 7: Implement parser**

Create `src/parser.ts`:

```typescript
import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import type { UsageRecord } from "./types.js";
import { getSessionFiles, extractProjectName } from "./utils/paths.js";

export function parseJsonlLine(line: string): Omit<UsageRecord, "project"> & { project: string } | null {
  try {
    const obj = JSON.parse(line);

    if (!obj.usage || !obj.model || !obj.timestamp) return null;
    if (typeof obj.usage.input_tokens !== "number" && typeof obj.usage.output_tokens !== "number") return null;

    return {
      timestamp: obj.timestamp,
      model: obj.model,
      usage: {
        input_tokens: obj.usage.input_tokens ?? 0,
        output_tokens: obj.usage.output_tokens ?? 0,
        cache_creation_input_tokens: obj.usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: obj.usage.cache_read_input_tokens ?? 0,
      },
      project: "",
    };
  } catch {
    return null;
  }
}

export function parseAllSessions(): UsageRecord[] {
  const files = getSessionFiles();
  const records: UsageRecord[] = [];

  for (const file of files) {
    const projectDirName = basename(dirname(file));
    const projectName = extractProjectName(projectDirName);
    const content = readFileSync(file, "utf-8");

    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      const record = parseJsonlLine(line);
      if (record) {
        record.project = projectName;
        records.push(record);
      }
    }
  }

  return records;
}
```

- [ ] **Step 8: Run all tests**

```bash
npx vitest run
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/utils/paths.ts src/parser.ts tests/
git commit -m "feat: add path utilities and JSONL session parser"
```

---

### Task 3: Pricing Engine

**Files:**
- Create: `src/pricing.ts`
- Create: `tests/pricing.test.ts`

**Interfaces:**
- Consumes: `UsageRecord`, `PricingTable`, `PricingEntry`, `DateDependentPricing`, `CostRecord` from `src/types.ts`
- Produces: `loadPricing(): PricingTable`, `calculateCost(record: UsageRecord): CostRecord`, `calculateAllCosts(records: UsageRecord[]): CostRecord[]`

- [ ] **Step 1: Write pricing tests**

Create `tests/pricing.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { matchModel, resolvePricing, calculateCost } from "../src/pricing.js";
import type { UsageRecord, PricingEntry } from "../src/types.js";

describe("matchModel", () => {
  it("matches opus-4-6 to claude-opus-4 pattern", () => {
    expect(matchModel("claude-opus-4-6")).toBe("claude-opus-4");
  });

  it("matches opus-5-20250601 to claude-opus-5 pattern", () => {
    expect(matchModel("claude-opus-5-20250601")).toBe("claude-opus-5");
  });

  it("matches sonnet-5-20250514 to claude-sonnet-5 pattern", () => {
    expect(matchModel("claude-sonnet-5-20250514")).toBe("claude-sonnet-5");
  });

  it("matches haiku-4-5-20251001 to claude-haiku-4 pattern", () => {
    expect(matchModel("claude-haiku-4-5-20251001")).toBe("claude-haiku-4");
  });

  it("returns null for unknown models", () => {
    expect(matchModel("gpt-4")).toBeNull();
  });
});

describe("resolvePricing", () => {
  it("returns intro pricing for sonnet-5 before Sep 2025", () => {
    const pricing = resolvePricing("claude-sonnet-5", "2025-08-15T00:00:00Z");
    expect(pricing.input).toBe(2);
    expect(pricing.output).toBe(10);
  });

  it("returns full pricing for sonnet-5 after Sep 2025", () => {
    const pricing = resolvePricing("claude-sonnet-5", "2025-09-15T00:00:00Z");
    expect(pricing.input).toBe(3);
    expect(pricing.output).toBe(15);
  });

  it("returns standard pricing for non-date-dependent models", () => {
    const pricing = resolvePricing("claude-opus-5", "2026-01-01T00:00:00Z");
    expect(pricing.input).toBe(5);
    expect(pricing.output).toBe(25);
  });
});

describe("calculateCost", () => {
  it("calculates cost correctly for opus", () => {
    const record: UsageRecord = {
      timestamp: "2026-07-28T22:07:29.711Z",
      model: "claude-opus-5-20250601",
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 5000,
      },
      project: "test",
    };

    const cost = calculateCost(record);
    // input: 1000 * 5 / 1_000_000 = 0.005
    // output: 500 * 25 / 1_000_000 = 0.0125
    // cacheWrite: 200 * 6.25 / 1_000_000 = 0.00125
    // cacheRead: 5000 * 0.5 / 1_000_000 = 0.0025
    expect(cost.cost).toBeCloseTo(0.02125);
  });

  it("returns 0 cost for unknown models", () => {
    const record: UsageRecord = {
      timestamp: "2026-07-28T22:07:29.711Z",
      model: "unknown-model",
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      project: "test",
    };

    const cost = calculateCost(record);
    expect(cost.cost).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/pricing.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement pricing engine**

Create `src/pricing.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/pricing.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pricing.ts tests/pricing.test.ts
git commit -m "feat: add pricing engine with date-dependent rules and user overrides"
```

---

### Task 4: Aggregator

**Files:**
- Create: `src/aggregator.ts`
- Create: `tests/aggregator.test.ts`

**Interfaces:**
- Consumes: `CostRecord`, `AggregatedCost`, `TimePeriod` from `src/types.ts`
- Produces: `filterByPeriod(records: CostRecord[], period: TimePeriod): CostRecord[]`, `aggregate(records: CostRecord[]): AggregatedCost`, `getPeriodsummary(records: CostRecord[]): { daily: number, weekly: number, monthly: number, yearly: number, all: number }`

- [ ] **Step 1: Write aggregator tests**

Create `tests/aggregator.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/aggregator.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement aggregator**

Create `src/aggregator.ts`:

```typescript
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
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
      start = startOfWeek(now, { weekStartsOn: 1 });
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
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/aggregator.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/aggregator.ts tests/aggregator.test.ts
git commit -m "feat: add cost aggregator with time period filtering"
```

---

### Task 5: Format Utilities

**Files:**
- Create: `src/utils/format.ts`
- Create: `tests/format.test.ts`

**Interfaces:**
- Consumes: nothing external
- Produces: `formatCurrency(amount: number): string`, `formatPercent(value: number, total: number): string`, `getSpendColor(amount: number, average: number): string`, `formatModelName(modelId: string): string`

- [ ] **Step 1: Write format tests**

Create `tests/format.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatCurrency, formatPercent, formatModelName } from "../src/utils/format.js";

describe("formatCurrency", () => {
  it("formats dollars with 2 decimal places", () => {
    expect(formatCurrency(12.4)).toBe("$12.40");
  });

  it("adds comma separator for thousands", () => {
    expect(formatCurrency(1247.63)).toBe("$1,247.63");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("handles small amounts", () => {
    expect(formatCurrency(0.003)).toBe("$0.00");
  });
});

describe("formatPercent", () => {
  it("formats percentage with 1 decimal", () => {
    expect(formatPercent(42, 100)).toBe("42.0%");
  });

  it("handles zero total", () => {
    expect(formatPercent(5, 0)).toBe("0.0%");
  });
});

describe("formatModelName", () => {
  it("formats opus model id to readable name", () => {
    expect(formatModelName("claude-opus-5-20250601")).toBe("Opus 5");
  });

  it("formats sonnet model id", () => {
    expect(formatModelName("claude-sonnet-5-20250514")).toBe("Sonnet 5");
  });

  it("formats haiku model id", () => {
    expect(formatModelName("claude-haiku-4-5-20251001")).toBe("Haiku 4.5");
  });

  it("formats opus 4.x model ids", () => {
    expect(formatModelName("claude-opus-4-6")).toBe("Opus 4.6");
  });

  it("formats fable model id", () => {
    expect(formatModelName("claude-fable-5-20260101")).toBe("Fable 5");
  });

  it("returns raw id for unknown formats", () => {
    expect(formatModelName("unknown")).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/format.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement format utilities**

Create `src/utils/format.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/format.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/format.ts tests/format.test.ts
git commit -m "feat: add formatting utilities for currency, percent, and model names"
```

---

### Task 6: Quick Mode UI (Ink)

**Files:**
- Create: `src/ui/App.tsx`
- Create: `src/ui/QuickView.tsx`
- Create: `src/ui/Table.tsx`
- Create: `src/ui/BarChart.tsx`

**Interfaces:**
- Consumes: `AggregatedCost`, `TimePeriod`, `CliFlags` from `src/types.ts`; `formatCurrency`, `formatPercent`, `formatModelName`, `getSpendColor` from `src/utils/format.ts`; `aggregate`, `filterByPeriod`, `getPeriodSummary` from `src/aggregator.ts`
- Produces: `<App flags={CliFlags} records={CostRecord[]} />`, `<QuickView />`, `<Table />`, `<BarChart />`

- [ ] **Step 1: Create Table component**

Create `src/ui/Table.tsx`:

```tsx
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
```

- [ ] **Step 2: Create BarChart component**

Create `src/ui/BarChart.tsx`:

```tsx
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
```

- [ ] **Step 3: Create QuickView component**

Create `src/ui/QuickView.tsx`:

```tsx
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
```

- [ ] **Step 4: Create App component**

Create `src/ui/App.tsx`:

```tsx
import React from "react";
import { Box } from "ink";
import type { CostRecord, CliFlags } from "../types.js";
import { QuickView } from "./QuickView.js";

interface AppProps {
  records: CostRecord[];
  flags: CliFlags;
}

export function App({ records, flags }: AppProps) {
  if (flags.interactive) {
    // Dashboard component added in Task 7
    return <QuickView records={records} flags={flags} />;
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <QuickView records={records} flags={flags} />
    </Box>
  );
}
```

- [ ] **Step 5: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/ui/
git commit -m "feat: add quick mode UI components (QuickView, Table, BarChart)"
```

---

### Task 7: Interactive TUI Dashboard

**Files:**
- Create: `src/ui/Dashboard.tsx`
- Create: `src/ui/TrendChart.tsx`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Consumes: `CostRecord`, `TimePeriod`, `AggregatedCost` from `src/types.ts`; `filterByPeriod`, `aggregate` from `src/aggregator.ts`; `formatCurrency`, `formatPercent`, `formatModelName` from `src/utils/format.ts`; `<BarChart />` from `src/ui/BarChart.tsx`
- Produces: `<Dashboard records={CostRecord[]} />`, `<TrendChart records={CostRecord[]} period={TimePeriod} />`

- [ ] **Step 1: Create TrendChart component**

Create `src/ui/TrendChart.tsx`:

```tsx
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
```

- [ ] **Step 2: Create Dashboard component**

Create `src/ui/Dashboard.tsx`:

```tsx
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
```

- [ ] **Step 3: Update App.tsx to use Dashboard**

Replace `src/ui/App.tsx`:

```tsx
import React from "react";
import { Box } from "ink";
import type { CostRecord, CliFlags } from "../types.js";
import { QuickView } from "./QuickView.js";
import { Dashboard } from "./Dashboard.js";

interface AppProps {
  records: CostRecord[];
  flags: CliFlags;
}

export function App({ records, flags }: AppProps) {
  if (flags.interactive) {
    return <Dashboard records={records} />;
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <QuickView records={records} flags={flags} />
    </Box>
  );
}
```

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/ui/Dashboard.tsx src/ui/TrendChart.tsx src/ui/App.tsx
git commit -m "feat: add interactive TUI dashboard with period selection and trend chart"
```

---

### Task 8: CLI Entry Point & Wiring

**Files:**
- Create: `src/index.ts`

**Interfaces:**
- Consumes: `parseAllSessions` from `src/parser.ts`; `calculateAllCosts` from `src/pricing.ts`; `CliFlags` from `src/types.ts`; `<App />` from `src/ui/App.tsx`
- Produces: The runnable CLI — `npx clost`, `npx clost -i`, `npx clost --monthly --project`

- [ ] **Step 1: Create entry point**

Create `src/index.ts`:

```typescript
#!/usr/bin/env node
import meow from "meow";
import React from "react";
import { render } from "ink";
import { parseAllSessions } from "./parser.js";
import { calculateAllCosts } from "./pricing.js";
import { App } from "./ui/App.js";
import type { CliFlags } from "./types.js";

const cli = meow(
  `
  Usage
    $ clost [options]

  Options
    -i, --interactive  Open interactive TUI dashboard
    --daily            Show today's costs
    --weekly           Show this week's costs
    --monthly          Show this month's costs
    --yearly           Show this year's costs
    --all              Show all-time costs
    --project          Group by project
    --model            Group by model

  Examples
    $ clost
    $ clost --monthly --project
    $ clost -i
`,
  {
    importMeta: import.meta,
    flags: {
      interactive: { type: "boolean", shortFlag: "i", default: false },
      daily: { type: "boolean", default: false },
      weekly: { type: "boolean", default: false },
      monthly: { type: "boolean", default: false },
      yearly: { type: "boolean", default: false },
      all: { type: "boolean", default: false },
      project: { type: "boolean", default: false },
      model: { type: "boolean", default: false },
    },
  }
);

const flags: CliFlags = cli.flags as CliFlags;

const usageRecords = parseAllSessions();
const costRecords = calculateAllCosts(usageRecords);

render(React.createElement(App, { records: costRecords, flags }));
```

- [ ] **Step 2: Test the CLI end-to-end**

```bash
npx tsx src/index.ts
```

Expected: Summary card with actual cost data from your `~/.claude` directory

```bash
npx tsx src/index.ts --monthly --project
```

Expected: Table breakdown by project for this month

```bash
npx tsx src/index.ts -i
```

Expected: Full-screen interactive dashboard

- [ ] **Step 3: Build and test binary**

```bash
npx tsc
node bin/clost.js
```

Expected: Same output as `npx tsx src/index.ts`

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire up CLI entry point with meow argument parsing"
```

---

### Task 9: README & Package Polish

**Files:**
- Create: `README.md`
- Modify: `package.json` (add repository, homepage, files fields)
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces: Publishable npm package ready for `npm publish`

- [ ] **Step 1: Create .gitignore**

```
node_modules/
dist/
*.tgz
```

- [ ] **Step 2: Create README.md**

```markdown
# clost

Calculate your [Claude Code](https://docs.anthropic.com/en/docs/claude-code) costs instantly from local session data.

```bash
npx clost
```

## What it does

`clost` reads your local Claude Code session files (`~/.claude/projects/`) and calculates exactly how much you've spent — broken down by day, week, month, project, and model.

Zero config. Zero API keys. Works offline.

## Install

```bash
# Run directly (no install needed)
npx clost

# Or install globally
npm install -g clost
```

## Usage

```bash
clost              # Summary card: today, week, month, all-time
clost -i           # Interactive TUI dashboard
clost --daily      # Today's costs
clost --weekly     # This week's costs
clost --monthly    # This month's costs
clost --yearly     # This year's costs
clost --all        # All-time costs
clost --project    # Break down by project
clost --model      # Break down by model
```

Flags compose: `clost --monthly --project --model`

## Interactive Mode

```bash
clost -i
```

Full-screen dashboard with:
- Period switching (daily/weekly/monthly/yearly/all)
- Model cost breakdown with bar charts
- Project cost breakdown
- Spend trend over time

**Keys:** `←/→` switch period, `p` toggle projects, `m` toggle models, `q` quit

## Custom Pricing

Create `~/.clost/pricing.json` to override default rates:

```json
{
  "claude-opus-5": {
    "input": 5,
    "output": 25,
    "cacheWrite": 6.25,
    "cacheRead": 0.5
  }
}
```

Prices are in USD per 1M tokens.

## How it works

Claude Code stores session data as JSONL files in `~/.claude/projects/`. Each message includes token counts and model info. `clost` parses these files, applies per-model pricing (including date-dependent rates like Sonnet 5's intro pricing), and aggregates costs by time period, project, and model.

## License

MIT
```

- [ ] **Step 3: Update package.json with publish fields**

Add to `package.json`:
```json
{
  "files": ["dist", "bin", "defaults"],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/YOUR_USERNAME/clost.git"
  },
  "homepage": "https://github.com/YOUR_USERNAME/clost#readme"
}
```

- [ ] **Step 4: Verify full build + run cycle**

```bash
rm -rf dist
npx tsc
node bin/clost.js
node bin/clost.js -i
```

Expected: both modes work from compiled output

- [ ] **Step 5: Commit**

```bash
git add README.md .gitignore package.json
git commit -m "docs: add README, .gitignore, and publish config"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-07-29-clost-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?