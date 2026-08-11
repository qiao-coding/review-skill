/**
 * CLI integration tests — exec the built CLI binary directly.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = join(tmpdir(), "review-skill-test-cli");
const cliBin = join(import.meta.dirname, "..", "bin", "cli.js");
const pkgRoot = resolve(import.meta.dirname, "..");

function run(args: string, cwdOverride?: string) {
  const cwd = cwdOverride ?? root;
  return execSync(`node ${cliBin} ${args}`, {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, LANG: "en_US.UTF-8" },
    stdio: "pipe",
  });
}

beforeAll(() => {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "test", private: true, type: "module" }), "utf-8");
  // Install review-skill from local package
  execSync(`npm install "${pkgRoot}"`, { cwd: root, stdio: "pipe" });
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe.sequential("CLI --init", () => {
  it("creates skills/SKILL.md", () => {
    run("--init");
    expect(existsSync(join(root, "skills", "SKILL.md"))).toBe(true);
  });

  it("creates skill.config.js", () => {
    expect(existsSync(join(root, "skill.config.js"))).toBe(true);
  });

  it("config has defineConfig import", () => {
    const cfg = readFileSync(join(root, "skill.config.js"), "utf-8");
    expect(cfg).toContain('import { defineConfig } from "review-skill"');
    expect(cfg).toContain("skillsDir");
    expect(cfg).toContain("outputDir");
    expect(cfg).toContain("strip:");
    expect(cfg).toContain("comment: true");
    expect(cfg).toContain("formatting: true");
    expect(cfg).toContain("image: true");
    expect(cfg).toContain("blockquote: true");
    expect(cfg).toContain("thematicBreak: true");
    expect(cfg).toContain("bullet: true");
    expect(cfg).toContain("whitespace: true");
  });

  it("adds type:module to package.json", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
    expect(pkg.type).toBe("module");
  });

  it("adds skill scripts", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
    expect(pkg.scripts["skill:build"]).toBeTruthy();
    expect(pkg.scripts["skill:dev"]).toBeTruthy();
  });

  it("adds .skill to gitignore", () => {
    const gi = readFileSync(join(root, ".gitignore"), "utf-8");
    expect(gi).toContain(".skill/");
  });

  it("configures tsconfig path alias", () => {
    const tsc = JSON.parse(readFileSync(join(root, "tsconfig.json"), "utf-8"));
    expect(tsc.compilerOptions.paths?.["@review-skill/skill"]).toContain("./.skill/skill.ts");
  });
});

describe("CLI --help", () => {
  it("shows help text in English", () => {
    const out = run("--help");
    expect(out).toContain("review-skill");
    expect(out).toContain("Build skills");
  });

  it("shows help text in Chinese when LANG=zh_CN", () => {
    const out = execSync(`node ${cliBin} --help`, {
      cwd: root,
      encoding: "utf-8",
      env: { ...process.env, LANG: "zh_CN.UTF-8" },
      stdio: "pipe",
    });
    expect(out).toContain("构建");
    expect(out).toContain("编译");
  });
});

describe.sequential("CLI build", () => {
  it("builds skills in project", () => {
    // Ensure init ran
    const skillsDir = join(root, "skills", "review");
    if (!existsSync(skillsDir)) mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, "rules.md"), "# Test Rule\n\n<!-- note -->\n\nContent.", "utf-8");

    const out = run("");
    expect(out).toContain("Compiled");
    expect(out).toContain("skills");
    expect(existsSync(join(root, ".skill", "metadata.json"))).toBe(true);
    expect(existsSync(join(root, ".skill", "skill.ts"))).toBe(true);
  });

  it("strips comments in runtime output", () => {
    const runtime = readFileSync(join(root, ".skill", "runtime", "review", "rules.md"), "utf-8");
    expect(runtime).not.toContain("<!--");
    expect(runtime).toContain("Content");
  });
});

describe("Config loading", () => {
  it("preserves bold when formatting=false in config", () => {
    writeFileSync(join(root, "skill.config.js"), [
      'import { defineConfig } from "review-skill";',
      "export default defineConfig({",
      '  skillsDir: "skills",',
      '  outputDir: ".skill",',
      "  strip: { formatting: false },",
      "});",
    ].join("\n"), "utf-8");

    writeFileSync(join(root, "skills", "test.md"), "**bold** text", "utf-8");
    run("");
    const runtime = readFileSync(join(root, ".skill", "runtime", "test.md"), "utf-8");
    expect(runtime).toContain("**bold**");
  });
});
