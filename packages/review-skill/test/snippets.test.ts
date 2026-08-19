import { describe, it, expect, afterAll } from "vitest";
import { emitSnippets } from "../src/compiler/emit/snippets.js";
import type { SkillMeta } from "../src/types.js";
import { readFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = join(tmpdir(), "review-skill-test-snippets");

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const entries: SkillMeta[] = [
  {
    path: "/",
    title: "Root Skill",
    description: "Root desc",
    isSkill: true,
    source: { characters: 10, tokens: 2 },
    runtime: { characters: 10, tokens: 2 },
  },
  {
    path: "/galgame/section-plan",
    title: "Section Plan",
    description: "Chapter template",
    isSkill: true,
    source: { characters: 10, tokens: 2 },
    runtime: { characters: 10, tokens: 2 },
  },
  {
    path: "/review/rules/state.md",
    title: "State Rules",
    description: "",
    isSkill: false,
    source: { characters: 10, tokens: 2 },
    runtime: { characters: 10, tokens: 2 },
  },
];

describe("emitSnippets", () => {
  it("writes valid snippet JSON with @/path prefix and body", async () => {
    mkdirSync(dir, { recursive: true });
    await emitSnippets(entries, dir);
    const path = join(dir, "skills.code-snippets");
    expect(existsSync(path)).toBe(true);

    const json = JSON.parse(readFileSync(path, "utf-8"));
    expect(json["@/galgame/section-plan"]).toEqual({
      prefix: "@/galgame/section-plan",
      body: "@/galgame/section-plan",
      description: "/galgame/section-plan → Section Plan",
    });
    expect(json["@/review/rules/state.md"].prefix).toBe("@/review/rules/state.md");
  });

  it("labels the root skill without a path prefix", async () => {
    mkdirSync(dir, { recursive: true });
    await emitSnippets(entries, dir);
    const json = JSON.parse(readFileSync(join(dir, "skills.code-snippets"), "utf-8"));
    expect(json["@/"].description).toBe("Root Skill");
  });
});
