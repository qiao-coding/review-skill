import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadSkills, resolveRuntimeFile, previewLines, mentionToPath, mentionStart } from "../src/core.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = join(tmpdir(), "review-skill-tip-test");
const skillDir = join(root, ".skill");

beforeAll(() => {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(skillDir, "runtime", "galgame", "section-plan"), { recursive: true });
  mkdirSync(join(skillDir, "runtime", "rules"), { recursive: true });

  writeFileSync(
    join(skillDir, "metadata.json"),
    JSON.stringify([
      {
        path: "/",
        title: "Root Skill",
        description: "Root desc",
        isSkill: true,
      },
      {
        path: "/galgame/section-plan",
        title: "Section Plan",
        description: "Chapter template",
        isSkill: true,
      },
      {
        path: "/rules/state.md",
        title: "State Rules",
        description: "",
        isSkill: false,
      },
    ]),
    "utf-8"
  );
  writeFileSync(
    join(skillDir, "runtime", "galgame", "section-plan", "SKILL.md"),
    "# Section Plan\n\nLine two.\nLine three.\nLine four.\nLine five.\n",
    "utf-8"
  );
  writeFileSync(join(skillDir, "runtime", "rules", "state.md"), "State rules body.\n", "utf-8");
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("loadSkills", () => {
  it("loads compiled metadata", () => {
    const skills = loadSkills(root);
    expect(skills).toHaveLength(3);
    expect(skills[1].path).toBe("/galgame/section-plan");
  });

  it("returns [] when the project has not been built", () => {
    expect(loadSkills(join(root, "nope"))).toEqual([]);
  });
});

describe("resolveRuntimeFile", () => {
  it("resolves a skill's SKILL.md", () => {
    const content = resolveRuntimeFile(root, "/galgame/section-plan", true);
    expect(content).toContain("# Section Plan");
  });

  it("resolves a resource file", () => {
    const content = resolveRuntimeFile(root, "/rules/state.md", false);
    expect(content).toContain("State rules body");
  });

  it("returns null for missing paths", () => {
    expect(resolveRuntimeFile(root, "/missing", true)).toBeNull();
  });
});

describe("previewLines", () => {
  it("truncates and reports the total", () => {
    const content = "a\nb\nc\nd\ne\n";
    expect(previewLines(content, 3)).toBe("a\nb\nc\n…（共 5 行）");
  });

  it("shows the whole content when within the limit", () => {
    expect(previewLines("a\nb\n", 3)).toBe("a\nb");
  });
});

describe("mentionToPath", () => {
  it("strips the leading @", () => {
    expect(mentionToPath("@/galgame/section-plan")).toBe("/galgame/section-plan");
  });
});

describe("mentionStart", () => {
  it("finds the start of a partial @ mention at the cursor", () => {
    expect(mentionStart("See @/react rul", 10)).toBe(4); // cursor after "react"
  });
  it("finds a bare @", () => {
    expect(mentionStart("See @ here", 5)).toBe(4);
  });
  it("returns -1 outside a mention", () => {
    expect(mentionStart("See path here", 4)).toBe(-1);
    expect(mentionStart("See @x, y", 8)).toBe(-1); // past the mention, after space
  });
  it("keeps the start correct when @ and / are word chars", () => {
    // "See @/galgame/section-plan." cursor before the trailing period
    const line = "See @/galgame/section-plan.";
    expect(mentionStart(line, line.length - 1)).toBe(4);
  });
});
