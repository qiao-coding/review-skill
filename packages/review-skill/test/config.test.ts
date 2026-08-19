import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { compile } from "../src/compiler/pipeline.js";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = join(tmpdir(), "review-skill-test-config");
const skillsDir = join(root, "skills");
const outputDir = join(root, ".skill");

function setup(skills: Record<string, string>) {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(skillsDir, { recursive: true });
  for (const [path, content] of Object.entries(skills)) {
    const full = join(skillsDir, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content, "utf-8");
  }
}

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("strip config", () => {
  it("keeps bold by default — stripping is opt-in", async () => {
    setup({ "SKILL.md": "**bold** text" });
    const r = await compile(skillsDir, outputDir);
    const content = readFileSync(join(outputDir, "runtime", "SKILL.md"), "utf-8");
    expect(content).toContain("**bold**");
  });

  it("preserves bold when formatting=false", async () => {
    setup({ "SKILL.md": "**bold** text" });
    const r = await compile(skillsDir, outputDir, { formatting: false });
    const content = readFileSync(join(outputDir, "runtime", "SKILL.md"), "utf-8");
    expect(content).toContain("**bold**");
  });

  it("preserves comment when comment=false", async () => {
    setup({ "SKILL.md": "# Title\n<!-- note -->\nContent" });
    const r = await compile(skillsDir, outputDir, { comment: false });
    const content = readFileSync(join(outputDir, "runtime", "SKILL.md"), "utf-8");
    expect(content).toContain("<!-- note -->");
  });

  it("preserves bullet markers when bullet=false", async () => {
    setup({ "SKILL.md": "- item 1\n- item 2" });
    const r = await compile(skillsDir, outputDir, { bullet: false });
    const content = readFileSync(join(outputDir, "runtime", "SKILL.md"), "utf-8");
    expect(content).toMatch(/\* item/); // remark converts - to *
  });

  it("preserves blockquote when blockquote=false", async () => {
    setup({ "SKILL.md": "> quoted text" });
    const r = await compile(skillsDir, outputDir, { blockquote: false });
    const content = readFileSync(join(outputDir, "runtime", "SKILL.md"), "utf-8");
    expect(content).toContain("quoted text");
  });

  it("preserves thematic break when thematicBreak=false", async () => {
    setup({ "SKILL.md": "# Title\n\n---\n\nContent" });
    const r = await compile(skillsDir, outputDir, { thematicBreak: false });
    const content = readFileSync(join(outputDir, "runtime", "SKILL.md"), "utf-8");
    expect(content).toContain("***"); // remark-stringify converts --- to ***
  });

  it("preserves image when image=false", async () => {
    setup({ "SKILL.md": "text ![alt](img.png) more" });
    const r = await compile(skillsDir, outputDir, { image: false });
    const content = readFileSync(join(outputDir, "runtime", "SKILL.md"), "utf-8");
    expect(content).toContain("![alt](img.png)");
  });

  it("preserves whitespace when whitespace=false", async () => {
    setup({ "SKILL.md": "line1\n\n\n\n\n\nline2" });
    const r = await compile(skillsDir, outputDir, { whitespace: false });
    const content = readFileSync(join(outputDir, "runtime", "SKILL.md"), "utf-8");
    // With whitespace=false, blank lines should not be collapsed to 1
    expect(content).toContain("\n\n");
  });

  it("multiple strip options combined", async () => {
    setup({ "SKILL.md": "**bold** and - bullet" });
    const r = await compile(skillsDir, outputDir, {
      formatting: false,
      bullet: false,
    });
    const content = readFileSync(join(outputDir, "runtime", "SKILL.md"), "utf-8");
    expect(content).toContain("**bold**");
    expect(content).toContain("bullet");
  });

  it("empty strip options means strip all", async () => {
    setup({ "SKILL.md": "**bold** <!-- comment --> - bullet" });
    const r = await compile(skillsDir, outputDir, {});
    const content = readFileSync(join(outputDir, "runtime", "SKILL.md"), "utf-8");
    expect(content).not.toContain("**");
    expect(content).not.toContain("<!--");
  });
});

describe("compile edge cases", () => {
  it("handles empty skills directory", async () => {
    rmSync(root, { recursive: true, force: true });
    mkdirSync(skillsDir, { recursive: true });
    const r = await compile(skillsDir, outputDir);
    expect(r.entries).toHaveLength(0);
  });

  it("handles deeply nested skills", async () => {
    setup({
      "SKILL.md": "# Root",
      "a/b/c/d/SKILL.md": "# Deep",
      "a/b/c/d/guide.md": "# Guide",
    });
    const r = await compile(skillsDir, outputDir);
    expect(r.entries).toHaveLength(3);
  });

  it("handles markdown with special characters", async () => {
    setup({ "SKILL.md": "Emoji: 🎉 你好 CJK `code` _underscore_ [link](url)" });
    const r = await compile(skillsDir, outputDir);
    const content = readFileSync(join(outputDir, "runtime", "SKILL.md"), "utf-8");
    expect(content).toContain("🎉");
    expect(content).toContain("你好");
    expect(content).toContain("`code`");
    expect(content).toContain("[link](url)");
  });
});
