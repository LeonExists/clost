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
    const remaining = segments.slice(lastMarkerIdx + 1);
    // 1-2 segments: likely a hyphenated project name (e.g. "my-app"), keep dashes
    // 3+ segments: likely a multi-word name with spaces encoded as dashes (e.g. "LOCKED IN PROJECTS")
    if (remaining.length <= 2) {
      return remaining.join("-").trim();
    }
    return remaining.join(" ").replace(/\s+/g, " ").trim();
  }

  // Fallback: take everything after the last "---" (triple dash = literal dash in encoded path)
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
