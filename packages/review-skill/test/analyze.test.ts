import { describe, it, expect } from "vitest";
import { analyze } from "../src/compiler/analyze.js";
import { parseMarkdown } from "../src/compiler/parse.js";

describe("analyze", () => {
  it("extracts title from H1", () => {
    const ast = parseMarkdown("# My Title\n\nSome content");
    const result = analyze(ast);
    expect(result.title).toBe("My Title");
  });

  it("extracts description from first paragraph after H1", () => {
    const ast = parseMarkdown("# Title\n\nThis is the description.\n\n## Section");
    const result = analyze(ast);
    expect(result.title).toBe("Title");
    expect(result.description).toBe("This is the description.");
  });

  it("handles missing title", () => {
    const ast = parseMarkdown("Just some text\n\nMore text");
    const result = analyze(ast);
    expect(result.title).toBe("");
  });

  it("extracts heading tree", () => {
    const ast = parseMarkdown("# Main\n\n## Sub\n\n### Deep");
    const result = analyze(ast);
    expect(result.headingTree).toContain("Main");
    expect(result.headingTree).toContain("  Sub");
    expect(result.headingTree).toContain("    Deep");
  });
});
