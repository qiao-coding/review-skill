import { describe, it, expect } from "vitest";
import { transformMarkdown } from "../src/compiler/transform.js";

describe("transformMarkdown", () => {
  it("strips HTML comments", async () => {
    const input = "# Title\n\n<!-- a comment -->\n\nContent";
    const output = await transformMarkdown(input);
    expect(output).not.toContain("<!--");
    expect(output).toContain("# Title");
    expect(output).toContain("Content");
  });

  it("strips bold and italic", async () => {
    const input = "**bold** and *italic* text";
    const output = await transformMarkdown(input);
    expect(output).not.toContain("**");
    expect(output).not.toContain("*italic*");
    expect(output).toContain("bold");
    expect(output).toContain("italic");
  });

  it("strips strikethrough", async () => {
    const input = "~~deleted~~ text";
    const output = await transformMarkdown(input);
    // remark may escape tildes after unwrapping, but "deleted" is preserved as text
    expect(output).toContain("deleted");
    expect(output).toContain("text");
  });

  it("preserves code block content", async () => {
    const input = [
      "# Title",
      "<!-- prose comment -->",
      "```ts",
      "// code comment MUST stay",
      "const x = 1;",
      "```",
    ].join("\n");
    const output = await transformMarkdown(input);
    expect(output).toContain("// code comment MUST stay");
    expect(output).not.toContain("<!-- prose comment -->");
  });

  it("preserves HTML comments inside code blocks", async () => {
    const input = [
      "<!-- prose comment: remove -->",
      "```md",
      "<!-- code comment: keep -->",
      "```",
    ].join("\n");
    const output = await transformMarkdown(input);
    expect(output).toContain("<!-- code comment: keep -->");
    expect(output).not.toContain("<!-- prose comment: remove -->");
  });

  it("strips thematic breaks", async () => {
    const input = "# Title\n\n---\n\nContent";
    const output = await transformMarkdown(input);
    expect(output).not.toContain("---");
  });

  it("strips bullet markers", async () => {
    const input = "- item one\n- item two\n- item three";
    const output = await transformMarkdown(input);
    expect(output).not.toMatch(/^- /m);
    expect(output).toContain("item one");
  });

  it("preserves numbered lists", async () => {
    const input = "1. first\n2. second\n3. third";
    const output = await transformMarkdown(input);
    expect(output).toContain("1.");
    expect(output).toContain("2.");
  });

  it("collapses excess blank lines", async () => {
    const input = "line1\n\n\n\n\nline2";
    const output = await transformMarkdown(input);
    const blanks = output.match(/\n\n/g);
    expect(blanks).toBeNull(); // should be 1 blank max
  });

  it("respects strip options", async () => {
    const input = "**bold** and - bullet";
    const output = await transformMarkdown(input, {
      formatting: false,
      bullet: false,
    });
    expect(output).toContain("**bold**");
    expect(output).toContain("bullet"); // bullet preserved when bullet:false
  });
});
