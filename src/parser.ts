import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import type { UsageRecord } from "./types.js";
import { getSessionFiles, extractProjectName } from "./utils/paths.js";

export function parseJsonlLine(line: string): Omit<UsageRecord, "project"> & { project: string } | null {
  try {
    const obj = JSON.parse(line);

    const timestamp = obj.timestamp;
    const model = obj.model ?? obj.message?.model;
    const usage = obj.usage ?? obj.message?.usage;

    if (!usage || !model || !timestamp) return null;
    if (typeof usage.input_tokens !== "number" && typeof usage.output_tokens !== "number") return null;

    return {
      timestamp,
      model,
      usage: {
        input_tokens: usage.input_tokens ?? 0,
        output_tokens: usage.output_tokens ?? 0,
        cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
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
