import type { SkillRef, SkillMeta } from "./types.js";
import { readFileSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export function defineConfig<T extends Record<string, unknown>>(config: T): T {
  return config;
}

/** Load metadata.json synchronously — called once at import time. */
export function loadMetadata(baseDir: string): SkillMeta[] {
  const path = join(baseDir, "metadata.json");
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as SkillMeta[];
  } catch {
    return [];
  }
}

function readRuntimePath(baseDir: string, path: string, isSkill: boolean): string {
  return isSkill
    ? join(baseDir, "runtime", path.replace(/^\//, ""), "SKILL.md")
    : join(baseDir, "runtime", path.replace(/^\//, ""));
}

/** Create a SkillRef from metadata. Synchronous — metadata must be pre-loaded. */
export function createSkill(
  path: string,
  meta: SkillMeta,
  baseDir: string
): SkillRef {
  const filePath = readRuntimePath(baseDir, path, meta.isSkill);

  return {
    meta,
    async read(): Promise<string> {
      return readFile(filePath, "utf-8");
    },
  };
}

/** Resolve a skill path from pre-loaded metadata. Throws on unknown paths. */
export function resolveSkill(
  path: string,
  metadata: SkillMeta[],
  baseDir: string
): SkillRef {
  const entry = metadata.find((m) => m.path === path);
  if (!entry) {
    throw new Error(
      `Skill not found: "${path}". Run "npx review-skill" to compile.`
    );
  }
  return createSkill(path, entry, baseDir);
}

// ── Default skill() export ──────────────────────────────────

const _meta = loadMetadata(".skill");

/** Get a compiled skill by path. Works without the generated .skill/skill.ts wrapper. */
export function skill(path: string): SkillRef {
  return resolveSkill(path, _meta, ".skill");
}
