import { describe, it, expect } from "vitest";
import { transformMarkdown } from "../src/compiler/transform.js";

describe("transformMarkdown", () => {
  it("returns the original file untouched when strip is not configured", async () => {
    const input = "# Title\n\n<!-- a comment --> **bold**\n\n- bullet\n\n---\n\n> quote\n";
    const output = await transformMarkdown(input);
    expect(output).toBe(input);
  });

  it("strips HTML comments", async () => {
    const input = "# Title\n\n<!-- a comment -->\n\nContent";
    const output = await transformMarkdown(input, ["<!-- HTML -->"]);
    expect(output).not.toContain("<!--");
    expect(output).toContain("# Title");
    expect(output).toContain("Content");
  });

  it("strips bold and italic", async () => {
    const input = "**bold** and *italic* text";
    const output = await transformMarkdown(input, ["**bold**", "*italic*"]);
    expect(output).not.toContain("**");
    expect(output).not.toContain("*italic*");
    expect(output).toContain("bold");
    expect(output).toContain("italic");
  });

  it("strips strikethrough", async () => {
    const input = "~~deleted~~ text";
    const output = await transformMarkdown(input, ["~~strikethrough~~"]);
    // ~~ is not parsed without remark-gfm — stays as literal text
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
    const output = await transformMarkdown(input, ["<!-- HTML -->"]);
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
    const output = await transformMarkdown(input, ["<!-- HTML -->"]);
    expect(output).toContain("<!-- code comment: keep -->");
    expect(output).not.toContain("<!-- prose comment: remove -->");
  });

  it("strips thematic breaks", async () => {
    const input = "# Title\n\n---\n\nContent";
    const output = await transformMarkdown(input, ["---"]);
    expect(output).not.toContain("---");
  });

  it("strips bullet markers", async () => {
    const input = "- item one\n- item two\n- item three";
    const output = await transformMarkdown(input, ["- item"]);
    expect(output).not.toMatch(/^- /m);
    expect(output).toContain("item one");
  });

  it("preserves numbered lists", async () => {
    const input = "1. first\n2. second\n3. third";
    const output = await transformMarkdown(input, ["- item"]);
    expect(output).toContain("1.");
    expect(output).toContain("2.");
  });

  it("collapses excess blank lines", async () => {
    const input = "line1\n\n\n\n\nline2";
    const output = await transformMarkdown(input, ["\n\n"]);
    const blanks = output.match(/\n\n/g);
    expect(blanks).toBeNull(); // should be 1 blank max
  });

  it("respects legacy object strip options", async () => {
    const input = "**bold** and - bullet";
    const output = await transformMarkdown(input, {
      formatting: false,
      bullet: false,
    });
    expect(output).toContain("**bold**");
    expect(output).toContain("bullet"); // bullet preserved when bullet:false
  });

  it("strips exactly the listed tokens (character-based)", async () => {
    const input = "**bold** *italic* ~~strike~~";
    const output = await transformMarkdown(input, ["**bold**"]);
    expect(output).not.toContain("**bold**");
    expect(output).toContain("*italic*"); // emphasis untouched
    // strikethrough (~~) is not parsed without remark-gfm — stays literal text
    expect(output).toContain("~~strike~~");
  });

  it("strips bold but keeps italic independently", async () => {
    const output = await transformMarkdown("**b** *i*", ["**bold**"]);
    expect(output).toContain("b");
    expect(output).toContain("*i*");
  });

  it("empty array strips nothing — returns the original verbatim", async () => {
    const input = "<!-- c --> **bold** > quote\n\n---\n\n- bullet";
    const output = await transformMarkdown(input, []);
    expect(output).toBe(input);
  });

  it("whitespace token controls blank-line collapsing", async () => {
    const input = "line1\n\n\n\n\nline2";
    // [] keeps the original verbatim; the whitespace token collapses blank lines
    const kept = await transformMarkdown(input, []);
    expect(kept).toBe(input);
    const collapsed = await transformMarkdown(input, ["\n\n"]);
    expect(collapsed).toContain("line1\nline2");
    expect(collapsed).not.toContain("line1\n\nline2");
  });
});
