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
