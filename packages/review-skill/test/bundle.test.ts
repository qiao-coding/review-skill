import { describe, it, expect, afterAll } from "vitest";
import { inlineRefs, createSkill } from "../src/skill.js";
import type { SkillMeta } from "../src/types.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const base = join(tmpdir(), "review-skill-test-bundle");

afterAll(() => rmSync(base, { recursive: true, force: true }));

const docs: Record<string, string> = {
  "/a": "# A\n\nRefs @/b and @/c.\n",
  "/b": "# B\n\nRefs @/c.\n",
  "/c": "# C\n\nLeaf.\n",
};
const resolve = (p: string) => docs[p] ?? null;

describe("inlineRefs", () => {
  it("inlines a known reference with wrapper markers", () => {
    const out = inlineRefs("See @/c now.", resolve);
    expect(out).toContain("[@/c]");
    expect(out).toContain("[/@/c]");
    expect(out).toContain("# C");
    expect(out).toContain("Leaf.");
  });

  it("leaves unknown references and bare @mentions untouched", () => {
    const out = inlineRefs("See @/nope and @user.", resolve);
    expect(out).toContain("@/nope");
    expect(out).toContain("@user");
  });

  it("recurses through nested references", () => {
    const out = inlineRefs(docs["/a"], resolve);
    expect(out).toContain("[@/b]");
    expect(out).toContain("[@/c]");
    expect(out).toContain("Leaf.");
    expect(out).not.toContain("[cycle");
  });

  it("inlines a diamond reference at each occurrence (no global dedup)", () => {
    const out = inlineRefs(docs["/a"], resolve);
    // @/c is referenced from both /a and /b — each occurrence resolves.
    expect(out.match(/\[@\/c\]/g)).toHaveLength(2);
  });

  it("breaks reference cycles with a marker", () => {
    const cyc: Record<string, string> = {
      "/a": "# A\n\nRefs @/b.\n",
      "/b": "# B\n\nRefs @/a.\n",
    };
    const out = inlineRefs(cyc["/a"], (p) => cyc[p] ?? null);
    expect(out).toContain("[cycle @/b]");
  });

  it("resolves the bare @/ root reference", () => {
    const out = inlineRefs("Root is @/.", (p) => (p === "/" ? "# ROOT\n\nBody.\n" : null));
    expect(out).toContain("[@/]");
    expect(out).toContain("# ROOT");
  });
});

describe("SkillRef.bundle()", () => {
  it("inlines references from compiled runtime files", () => {
    mkdirSync(join(base, "runtime", "a"), { recursive: true });
    writeFileSync(join(base, "runtime", "a", "SKILL.md"), "# A\n\nSee @/b and @/ghost.\n", "utf-8");
    mkdirSync(join(base, "runtime", "b"), { recursive: true });
    writeFileSync(join(base, "runtime", "b", "SKILL.md"), "# B\n\nB body.\n", "utf-8");

    const meta: SkillMeta = {
      path: "/a",
      title: "A",
      description: "",
      isSkill: true,
      source: { characters: 10, tokens: 2 },
      runtime: { characters: 10, tokens: 2 },
    };
    const ref = createSkill("/a", meta, base);
    const out = ref.bundle();
    expect(out).toContain("[@/b]");
    expect(out).toContain("# B");
    expect(out).toContain("B body.");
    expect(out).toContain("@/ghost"); // unknown → left as-is
  });

  it("resolves resource references", () => {
    mkdirSync(join(base, "runtime", "rules"), { recursive: true });
    writeFileSync(join(base, "runtime", "rules", "state.md"), "State rules body.\n", "utf-8");
    writeFileSync(join(base, "runtime", "a", "SKILL.md"), "# A\n\nSee @/rules/state.md.\n", "utf-8");

    const meta: SkillMeta = {
      path: "/a",
      title: "A",
      description: "",
      isSkill: true,
      source: { characters: 10, tokens: 2 },
      runtime: { characters: 10, tokens: 2 },
    };
    const ref = createSkill("/a", meta, base);
    const out = ref.bundle();
    expect(out).toContain("[@/rules/state.md]");
    expect(out).toContain("State rules body.");
  });
});
