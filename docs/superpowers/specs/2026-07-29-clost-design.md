# clost — Claude Code Cost Calculator

## Overview

A CLI/TUI tool written in TypeScript that calculates Claude Code costs by parsing local session data. Zero-config, offline, works for any Claude Code user.

**Name:** `clost` (claude + cost)  
**Install:** `npx clost` or `npm i -g clost`  
**Runtime:** Node.js (already present for Claude Code users)

## CLI Interface

```
clost              # Default: summary card (today/week/month/all-time)
clost -i           # Interactive TUI dashboard
clost --daily      # Today's costs
clost --weekly     # This week's costs
clost --monthly    # This month's costs
clost --yearly     # This year's costs
clost --all        # All-time costs
clost --project    # Group by project
clost --model      # Group by model
```

Flags compose: `clost --monthly --project --model` shows this month broken down by both project and model.

## Data Source

**Location:** `~/.claude/projects/<project-dir>/<session-id>.jsonl`

Each JSONL line contains message objects with:
- `timestamp` — ISO 8601 string
- `model` — e.g. `"claude-opus-4-6"`, `"claude-sonnet-5-20250514"`
- `usage.input_tokens` — standard input tokens
- `usage.output_tokens` — output tokens
- `usage.cache_creation_input_tokens` — cache write tokens
- `usage.cache_read_input_tokens` — cache read tokens

**Project name extraction:** Directory names use path encoding (e.g. `C--Users-LSzameitat-OneDrive---...`). Extract the last meaningful path segment and convert to human-readable form.

## Pricing Engine

### Default Pricing Table (USD per 1M tokens)

| Model Pattern | Input | Output | Cache Write | Cache Read |
|---------------|-------|--------|-------------|------------|
| `claude-fable-5*` | $10 | $50 | $12.50 | $1.00 |
| `claude-mythos-5*` | $10 | $50 | $12.50 | $1.00 |
| `claude-opus-5*` | $5 | $25 | $6.25 | $0.50 |
| `claude-opus-4*` | $5 | $25 | $6.25 | $0.50 |
| `claude-sonnet-5*` (before 2025-09-01) | $2 | $10 | $2.50 | $0.20 |
| `claude-sonnet-5*` (from 2025-09-01) | $3 | $15 | $3.75 | $0.30 |
| `claude-sonnet-4*` | $3 | $15 | $3.75 | $0.30 |
| `claude-haiku-4*` | $1 | $5 | $1.25 | $0.10 |

### Date-Dependent Pricing

Sonnet 5 has intro pricing ($2/$10) through Aug 31, 2025 and full pricing ($3/$15) from Sep 1, 2025. The engine checks message timestamps to apply the correct rate.

### User Override

Users can create `~/.clost/pricing.json` to override defaults:
```json
{
  "claude-opus-5*": {
    "input": 5,
    "output": 25,
    "cacheWrite": 6.25,
    "cacheRead": 0.50
  }
}
```

### Unknown Models

If a model ID doesn't match any pricing pattern, the message is still parsed and included in aggregations but with $0 cost. A warning is printed once per unknown model suggesting the user add it to `~/.clost/pricing.json`.

### Cost Calculation

Per message:
```
cost = (input_tokens * input_price / 1_000_000)
     + (output_tokens * output_price / 1_000_000)
     + (cache_creation_tokens * cache_write_price / 1_000_000)
     + (cache_read_tokens * cache_read_price / 1_000_000)
```

## Quick Mode Output

### Default (`clost`)

```
┌─────────────────────────────────────┐
│  clost — Claude Code Costs          │
├─────────────────────────────────────┤
│  Today        $12.40                │
│  This Week    $47.82                │
│  This Month   $184.20               │
│  All Time     $1,247.63             │
├─────────────────────────────────────┤
│  Top Project: my-app ($42.10 today) │
│  Top Model:   Opus 5 (78% of spend) │
└─────────────────────────────────────┘
```

### With breakdowns (`clost --monthly --project`)

```
  This Month — $184.20

  Project                     Cost        %
  ─────────────────────────────────────────
  my-app                    $82.40    44.7%
  api-service               $51.20    27.8%
  docs-site                 $28.60    15.5%
  scripts                   $22.00    12.0%
```

### Colors

- Green: below average spend
- Yellow: moderate spend
- Red: above average spend (relative to user's own history)

## Interactive TUI (`clost -i`)

Full-screen Ink application with keyboard navigation.

### Layout

- **Header:** Title + quit hint
- **Period selector:** Tab bar — Daily / Weekly / Monthly / Yearly / All
- **Total cost:** Large, color-coded
- **Model breakdown:** Horizontal bar chart with percentages
- **Project breakdown:** Horizontal bar chart with percentages
- **Trend chart:** Bar/sparkline chart showing cost over time within selected period

### Keybindings

| Key | Action |
|-----|--------|
| `←` / `→` or `Tab` | Cycle time periods |
| `↑` / `↓` | Scroll project list |
| `p` | Toggle project breakdown |
| `m` | Toggle model breakdown |
| `q` / `Esc` / `Ctrl+C` | Exit |

## Project Structure

```
clost/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts              # Entry point, CLI arg parsing
│   ├── parser.ts             # Reads & parses ~/.claude JSONL files
│   ├── pricing.ts            # Pricing table, cost calculation, config loading
│   ├── aggregator.ts         # Groups data by time/project/model
│   ├── types.ts              # Shared TypeScript types
│   ├── ui/
│   │   ├── App.tsx           # Ink root component
│   │   ├── QuickView.tsx     # Quick mode output
│   │   ├── Dashboard.tsx     # Interactive TUI layout
│   │   ├── BarChart.tsx      # Horizontal bar component
│   │   ├── TrendChart.tsx    # Sparkline/bar trend chart
│   │   └── Table.tsx         # Formatted table component
│   └── utils/
│       ├── paths.ts          # ~/.claude path resolution, project name extraction
│       └── format.ts         # Currency, percentage, color formatting
├── defaults/
│   └── pricing.json          # Default pricing table
└── bin/
    └── clost.js              # Shebang entry for npx/global install
```

## Tech Stack

| Dependency | Purpose |
|-----------|---------|
| `ink` + `react` | TUI rendering |
| `meow` | CLI argument parsing |
| `chalk` | Terminal colors |
| `date-fns` | Time period math |
| `typescript` | Type safety |
| `tsx` | Dev runner |
| `vitest` | Testing |

## Viral Strategy

No explicit sharing features. The tool sells itself by:
1. Being genuinely useful (every Claude Code user wonders about costs)
2. Looking beautiful in screenshots (colored bars, clean layout)
3. Being zero-friction (`npx clost` just works)
4. Having a memorable name
5. Solving a problem no other tool solves

## Non-Goals (v1)

- API-based usage tracking
- Multi-user/team dashboards
- Export to CSV/JSON (could add later)
- Historical price tracking
- Cost alerts/budgets
