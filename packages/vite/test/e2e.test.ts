import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { build } from "vite";
import { existsSync } from "node:fs";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { skillFramework } from "../src/index.js";

const root = join(tmpdir(), "review-skill-vite-e2e");

beforeAll(() => {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, "skills", "galgame", "section-plan"), { recursive: true });
  mkdirSync(join(root, "skills", "rules"), { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });

  writeFileSync(
    join(root, "skills", "galgame", "section-plan", "SKILL.md"),
    "---\ntitle: Section Plan\ndescription: Chapter\n---\n# Plan\n\nFollow @/rules/state.md.\n",
    "utf-8"
  );
  writeFileSync(join(root, "skills", "rules", "state.md"), "---\ntitle: State\n---\nState rules.\n", "utf-8");
  writeFileSync(
    join(root, "src", "main.ts"),
    `import plan from "@skill/galgame/section-plan";\nimport meta from "@skill/meta";\nconsole.log(plan.includes("State rules.") ? "refs-inlined" : "no");\nconsole.log(meta.length);\n`,
    "utf-8"
  );
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("skillFramework through a real vite build", () => {
  it("auto-compiles and serves @skill/* as inlineable modules", async () => {
    const result = await build({
      root,
      logLevel: "error",
      plugins: [skillFramework()],
      build: {
        write: false,
        lib: { entry: join(root, "src", "main.ts"), formats: ["es"] },
      },
    });

    // Auto-compile happened: .skill/metadata.json + runtime exist
    expect(existsSync(join(root, ".skill", "metadata.json"))).toBe(true);
    expect(existsSync(join(root, ".skill", "runtime", "galgame", "section-plan", "SKILL.md"))).toBe(true);

    const outputs = Array.isArray(result) ? result : [result];
    const chunk = outputs.flatMap((o) => o.output).find((o) => o.type === "chunk");
    const code = chunk?.code ?? "";
    // Runtime content survived with the @/ ref inlined
    expect(code).toContain("State rules.");
    expect(code).toContain("[@/rules/state.md]");
    // Frontmatter was stripped by the compiler
    expect(code).not.toContain("description: Chapter");
    // Metadata module is present
    expect(code).toContain("/rules/state.md");
  });
});
