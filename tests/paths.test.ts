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
