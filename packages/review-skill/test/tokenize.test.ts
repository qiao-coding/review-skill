import { describe, it, expect } from "vitest";
import { estimateTokens } from "../src/compiler/tokenize.js";

describe("estimateTokens", () => {
  it("estimates tokens as chars/4", () => {
    expect(estimateTokens(400)).toBe(100);
    expect(estimateTokens(100)).toBe(25);
  });

  it("rounds to nearest integer", () => {
    expect(estimateTokens(10)).toBe(3); // 10/4 = 2.5 → 3
    expect(estimateTokens(8)).toBe(2);  // 8/4 = 2
  });

  it("returns 0 for empty", () => {
    expect(estimateTokens(0)).toBe(0);
  });
});
