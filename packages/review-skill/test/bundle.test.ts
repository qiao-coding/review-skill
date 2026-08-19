import { describe, it, expect, afterAll } from "vitest";
import { inlineRefs, createSkill } from "../src/skill.js";
import type { SkillMeta } from "../src/types.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const base = join(tmpdir(), "review-skill-test-bundle");

afterAll(() => rmSync(base, { recursive: true, force: true }));

const docs: Record<string, string> = {
  "/a": "# A\n\nRefs [b](../b) and [c](../c).\n",
  "/b": "# B\n\nRefs [c](../c).\n",
  "/c": "# C\n\nLeaf.\n",
};
const resolve = (p: string) => docs[p] ?? null;

describe("inlineRefs", () => {
  it("inlines a known reference with wrapper markers", () => {
    const out = inlineRefs("See [c](../c) now.", "/", resolve);
    expect(out).toContain("[c](../c)");
    expect(out).toContain("[/c]");
    expect(out).toContain("# C");
    expect(out).toContain("Leaf.");
  });

  it("leaves unknown references and external links untouched", () => {
    const out = inlineRefs("See [nope](../nope) and [site](https://example.com).", "/", resolve);
    expect(out).toContain("[nope](../nope)");
    expect(out).toContain("https://example.com");
  });

  it("recurses through nested references", () => {
    const out = inlineRefs(docs["/a"], "/a", resolve);
    expect(out).toContain("[b](../b)");
    expect(out).toContain("[c](../c)");
    expect(out).toContain("Leaf.");
    expect(out).not.toContain("[cycle");
  });

  it("inlines a diamond reference at each occurrence (no global dedup)", () => {
    const out = inlineRefs(docs["/a"], "/a", resolve);
    // /c is referenced from both /a and /b — each occurrence resolves.
    expect(out.match(/\[c\]\(\.\.\/c\)/g)).toHaveLength(2);
  });

  it("breaks reference cycles with a marker", () => {
    const cyc: Record<string, string> = {
      "/a": "# A\n\nRefs [b](../b).\n",
      "/b": "# B\n\nRefs [a](../a).\n",
    };
    const out = inlineRefs(cyc["/a"], "/a", (p) => cyc[p] ?? null);
    expect(out).toContain("[cycle /b]");
  });

  it("resolves a relative link to the root skill", () => {
    const out = inlineRefs("Root is [root](./).", "/", (p) => (p === "/" ? "# ROOT\n\nBody.\n" : null));
    expect(out).toContain("[root](./)");
    expect(out).toContain("[/]");
    expect(out).toContain("# ROOT");
  });

  it("resolves a link relative to a nested file's directory", () => {
    // from /galgame/section-plan, ../security/SKILL.md → /security
    const out = inlineRefs(
      "See [security](../security/SKILL.md).",
      "/galgame/section-plan",
      (p) => (p === "/security" ? "# SECURITY\n\nRules.\n" : null)
    );
    expect(out).toContain("[/security]");
    expect(out).toContain("# SECURITY");
  });

  it("does not treat image links as references", () => {
    const out = inlineRefs("![diagram](../diagram.png)", "/", resolve);
    expect(out).toBe("![diagram](../diagram.png)");
  });
});

describe("SkillRef.bundle()", () => {
  it("inlines references from compiled runtime files", () => {
    mkdirSync(join(base, "runtime", "a"), { recursive: true });
    writeFileSync(join(base, "runtime", "a", "SKILL.md"), "# A\n\nSee [b](../b) and [ghost](../ghost).\n", "utf-8");
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
    expect(out).toContain("[b](../b)");
    expect(out).toContain("# B");
    expect(out).toContain("B body.");
    expect(out).toContain("[ghost](../ghost)"); // unknown → left as-is
  });

  it("resolves resource references", () => {
    mkdirSync(join(base, "runtime", "rules"), { recursive: true });
    writeFileSync(join(base, "runtime", "rules", "state.md"), "State rules body.\n", "utf-8");
    writeFileSync(join(base, "runtime", "a", "SKILL.md"), "# A\n\nSee [rules/state](../rules/state.md).\n", "utf-8");

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
    expect(out).toContain("[/rules/state.md]");
    expect(out).toContain("State rules body.");
  });
});
