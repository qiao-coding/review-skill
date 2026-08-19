import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { compile } from "../src/compiler/pipeline.js";
import { loadMetadata, createSkill } from "../src/skill.js";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = join(tmpdir(), "review-skill-test-pipeline");
const skillsDir = join(root, "skills");
const outputDir = join(root, ".skill");

beforeAll(() => {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(skillsDir, { recursive: true });
  writeFileSync(join(skillsDir, "SKILL.md"), [
    "# Test Root",
    "<!-- root comment -->",
    "Root description.",
    "",
    "## Rules",
    "- **always** be concise",
    "- *never* lie",
  ].join("\n"), "utf-8");

  mkdirSync(join(skillsDir, "review"), { recursive: true });
  writeFileSync(join(skillsDir, "review", "SKILL.md"), [
    "# Code Review",
    "<!-- review comment -->",
    "Review rules here.",
    "```ts",
    "// keep this",
    "const x = 1;",
    "```",
  ].join("\n"), "utf-8");

  writeFileSync(join(skillsDir, "review", "rules.md"), [
    "# State Rules",
    "Avoid derived state.",
    "```tsx",
    "// ❌ BAD",
    "const [x, setX] = useState(props.y);",
    "```",
  ].join("\n"), "utf-8");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("pipeline", () => {
  it("compiles skills and generates output", async () => {
    const result = await compile(skillsDir, outputDir);

    expect(result.entries).toHaveLength(3);
    expect(result.sourceTokens).toBeGreaterThan(0);
    expect(result.runtimeTokens).toBeGreaterThan(0);
    expect(result.runtimeTokens).toBeLessThanOrEqual(result.sourceTokens);
  });

  it("generates runtime markdown files", async () => {
    const rootRuntime = join(outputDir, "runtime", "SKILL.md");
    const reviewRuntime = join(outputDir, "runtime", "review", "SKILL.md");
    const rulesRuntime = join(outputDir, "runtime", "review", "rules.md");

    expect(existsSync(rootRuntime)).toBe(true);
    expect(existsSync(reviewRuntime)).toBe(true);
    expect(existsSync(rulesRuntime)).toBe(true);

    const content = readFileSync(rootRuntime, "utf-8");
    expect(content).not.toContain("<!--");
    expect(content).not.toContain("**");
    expect(content).toContain("always be concise");
  });

  it("preserves code blocks in runtime", async () => {
    const content = readFileSync(join(outputDir, "runtime", "review", "SKILL.md"), "utf-8");
    expect(content).toContain("// keep this");
    expect(content).toContain("const x = 1;");
    expect(content).not.toContain("<!-- review comment -->");
  });

  it("generates metadata.json", async () => {
    const metaPath = join(outputDir, "metadata.json");
    expect(existsSync(metaPath)).toBe(true);
    const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
    expect(Array.isArray(meta)).toBe(true);
    expect(meta.length).toBe(3);
    expect(meta[0].path).toBeDefined();
    expect(meta[0].title).toBeDefined();
  });

  it("generates skill.ts wrapper", async () => {
    const skillPath = join(outputDir, "skill.ts");
    expect(existsSync(skillPath)).toBe(true);
    const content = readFileSync(skillPath, "utf-8");
    expect(content).toContain('import { skill as _skill');
    expect(content).toContain('export function skill(path: "/"):');
    expect(content).toContain('export function skill(path: "/review"):');
    expect(content).toContain('export function skill(path: "/review/rules.md"):');
  });
});

describe("skill() runtime", () => {
  it("loads metadata", () => {
    const meta = loadMetadata(outputDir);
    expect(meta.length).toBe(3);
  });

  it("creates a SkillRef", () => {
    const meta = loadMetadata(outputDir);
    const ref = createSkill("/", meta.find((m) => m.path === "/")!, outputDir);
    expect(ref.meta.title).toBe("Test Root");
    expect(ref.meta.isSkill).toBe(true);
  });

  it("read() returns runtime content", async () => {
    const meta = loadMetadata(outputDir);
    const ref = createSkill("/review/rules.md", meta.find((m) => m.path === "/review/rules.md")!, outputDir);
    const content = await ref.read();
    expect(content).toContain("# State Rules");
  });
});

describe("pipeline variables contract", () => {
  const varRoot = join(root, "vars");
  const varSkills = join(varRoot, "skills");
  const varOut = join(varRoot, ".skill");

  const writeSkill = (body: string) => {
    mkdirSync(varSkills, { recursive: true });
    writeFileSync(join(varSkills, "SKILL.md"), body, "utf-8");
  };

  afterAll(() => rmSync(varRoot, { recursive: true, force: true }));

  it("parses frontmatter variables into metadata and strips frontmatter from runtime", async () => {
    writeSkill([
      "---",
      "variables:",
      "  - name: heroName",
      "  - name: isFinale",
      "    required: false",
      "---",
      "",
      "# Section Plan",
      "",
      "Hello {{heroName}}. Finale: {{isFinale}}.",
    ].join("\n"));

    const result = await compile(varSkills, varOut);
    const meta = result.entries.find((e) => e.path === "/")!;
    expect(meta.variables).toEqual([
      { name: "heroName", required: true },
      { name: "isFinale", required: false },
    ]);

    const runtime = readFileSync(join(varOut, "runtime", "SKILL.md"), "utf-8");
    expect(runtime).not.toContain("variables:");
    expect(runtime).not.toContain("---");
    expect(runtime).toContain("Hello {{heroName}}.");
  });

  it("rejects the build when a placeholder is undeclared", async () => {
    writeSkill([
      "---",
      "variables:",
      "  - name: known",
      "---",
      "",
      "Use {{known}} and {{ghost}}.",
    ].join("\n"));

    await expect(compile(varSkills, varOut)).rejects.toThrow(/ghost/);
  });

  it("collects warnings for unused optional variables", async () => {
    writeSkill([
      "---",
      "variables:",
      "  - name: used",
      "  - name: optional",
      "    required: false",
      "---",
      "",
      "Body with {{used}} only.",
    ].join("\n"));

    const result = await compile(varSkills, varOut);
    expect(result.warnings.some((w) => w.includes("optional"))).toBe(true);
  });
});
