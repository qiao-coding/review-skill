import { describe, it, expect } from "vitest";
import { discover, fileToPath } from "../src/compiler/discover.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("discover", () => {
  const dir = join(tmpdir(), "review-skill-test-discover");

  function setup(files: Record<string, string>) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const [path, content] of Object.entries(files)) {
      const full = join(dir, path);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, content, "utf-8");
    }
  }

  it("discovers root SKILL.md", async () => {
    setup({ "SKILL.md": "# Root" });
    const files = await discover(dir);
    expect(files).toHaveLength(1);
    expect(files[0]!.isSkill).toBe(true);
    expect(files[0]!.relativePath).toBe("SKILL.md");
    expect(fileToPath(files[0]!)).toBe("/");
  });

  it("discovers nested skills and resources", async () => {
    setup({
      "SKILL.md": "# Root",
      "review/SKILL.md": "# Review",
      "review/rules.md": "# Rules",
    });
    const files = await discover(dir);
    expect(files).toHaveLength(3);
    const skills = files.filter((f) => f.isSkill);
    expect(skills).toHaveLength(2);
    const resources = files.filter((f) => !f.isSkill);
    expect(resources).toHaveLength(1);
    expect(fileToPath(resources[0]!)).toBe("/review/rules.md");
  });

  it("returns empty for empty dir", async () => {
    setup({});
    const files = await discover(dir);
    expect(files).toHaveLength(0);
  });
});
