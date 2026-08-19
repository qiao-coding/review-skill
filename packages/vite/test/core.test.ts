import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  META_ID,
  RESOURCE_PREFIX,
  loadMeta,
  moduleForMeta,
  moduleForResource,
  needsCompile,
  readRuntime,
  resolveOutputDir,
  resolveVirtualId,
} from "../src/core.js";
import { mkdirSync, writeFileSync, rmSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = join(tmpdir(), "review-skill-vite-test");
const out = join(root, ".skill");
const runtime = join(out, "runtime");
const skills = join(root, "skills");

beforeAll(() => {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(runtime, "galgame", "section-plan"), { recursive: true });
  mkdirSync(join(runtime, "rules"), { recursive: true });
  mkdirSync(join(skills, "galgame", "section-plan"), { recursive: true });

  writeFileSync(
    join(out, "metadata.json"),
    JSON.stringify([
      { path: "/", title: "Root", description: "", isSkill: true },
      { path: "/galgame/section-plan", title: "Section Plan", description: "Chapter", isSkill: true },
      { path: "/rules/state.md", title: "State", description: "", isSkill: false },
    ]),
    "utf-8"
  );
  writeFileSync(
    join(runtime, "galgame", "section-plan", "SKILL.md"),
    "# Plan\n\nFollow @/rules/state.md.\n",
    "utf-8"
  );
  writeFileSync(join(runtime, "rules", "state.md"), "State rules.\n", "utf-8");
  writeFileSync(join(skills, "galgame", "section-plan", "SKILL.md"), "# Plan\n", "utf-8");
  // Stamp the source older than the build so the "no recompile needed" case is deterministic
  const past = new Date(Date.now() - 60_000);
  utimesSync(join(skills, "galgame", "section-plan", "SKILL.md"), past, past);
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("resolveVirtualId", () => {
  it("maps @skill/meta to the meta module", () => {
    expect(resolveVirtualId("@skill/meta")).toBe(META_ID);
  });
  it("maps @skill/<path> to a resource module", () => {
    expect(resolveVirtualId("@skill/galgame/section-plan")).toBe(`${RESOURCE_PREFIX}/galgame/section-plan`);
  });
  it("rejects foreign ids", () => {
    expect(resolveVirtualId("react")).toBeNull();
    expect(resolveVirtualId("@skillx/y")).toBeNull();
  });
});

describe("loadMeta", () => {
  it("loads compiled metadata", () => {
    const meta = loadMeta(root);
    expect(meta).toHaveLength(3);
    expect(meta[1].path).toBe("/galgame/section-plan");
  });
  it("returns [] when unbuilt", () => {
    expect(loadMeta(join(root, "nope"))).toEqual([]);
  });
});

describe("readRuntime + moduleForResource", () => {
  it("resolves a skill's SKILL.md", () => {
    expect(readRuntime(runtime, "/galgame/section-plan")).toContain("# Plan");
  });
  it("resolves a resource file", () => {
    expect(readRuntime(runtime, "/rules/state.md")).toContain("State rules");
  });
  it("returns null for missing paths", () => {
    expect(readRuntime(runtime, "/missing")).toBeNull();
  });
  it("inlines @/ refs into a self-contained module", () => {
    const src = moduleForResource(runtime, "/galgame/section-plan");
    expect(src).toContain("State rules.");
    expect(src).toContain("[@/rules/state.md]");
    expect(src).toContain("export default");
  });
  it("emits an empty module for unknown paths", () => {
    expect(moduleForResource(runtime, "/nope")).toContain("not found");
  });
});

describe("moduleForMeta", () => {
  it("emits a default-export ESM module", () => {
    const src = moduleForMeta(loadMeta(root));
    expect(src).toContain("export default");
    expect(src).toContain('"/galgame/section-plan"');
  });
});

describe("needsCompile", () => {
  it("is true when metadata is missing", () => {
    expect(needsCompile(join(root, "nope"))).toBe(true);
  });
  it("is false when sources are older than the build", () => {
    expect(needsCompile(root)).toBe(false);
  });
  it("is true when a source is newer than the build", () => {
    const future = new Date(Date.now() + 60_000);
    utimesSync(join(skills, "galgame", "section-plan", "SKILL.md"), future, future);
    expect(needsCompile(root)).toBe(true);
    // restore for the "older" case to stay deterministic
    const past = new Date(Date.now() - 60_000);
    utimesSync(join(skills, "galgame", "section-plan", "SKILL.md"), past, past);
  });
});

describe("resolveOutputDir", () => {
  it("defaults to .skill", () => {
    expect(resolveOutputDir(root)).toBe(join(root, ".skill"));
  });
});
