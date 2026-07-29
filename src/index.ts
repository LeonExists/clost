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
