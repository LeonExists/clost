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
