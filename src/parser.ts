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
