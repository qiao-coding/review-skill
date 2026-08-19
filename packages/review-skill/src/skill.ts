import type { SkillRef, SkillMeta } from "./types.js";
import { readFileSync, existsSync } from "node:fs";
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

/** Create a SkillRef from metadata. Reads compiled content synchronously. */
export function createSkill(
  path: string,
  meta: SkillMeta,
  baseDir: string
): SkillRef {
  const filePath = readRuntimePath(baseDir, path, meta.isSkill);
  const content = readFileSync(filePath, "utf-8");

  return {
    meta,
    content,
    async read(): Promise<string> {
      return content;
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

/**
 * Shared template placeholder pattern — must stay in sync between the compiler
 * (variable scanning/validation) and the runtime `inject`.
 * A single source avoids the "scan strips X but inject leaves it" drift.
 */
export const TEMPLATE_VAR_PATTERN = "\\{\\{\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*\\}\\}";

/**
 * Pure variable substitution: replaces `{{name}}` with the value from `vars`.
 * Missing keys become `""` (the "empty string = no such block" convention).
 * No template control flow — the caller decides what to inject.
 *
 * Typed usage: `inject<SectionPlanVars>(template, vars)` forces the object
 * literal to satisfy the generated per-skill interface at compile time
 * (missing required keys → TS2345).
 */
export function inject<V extends object>(template: string, vars: V): string {
  return template.replace(new RegExp(TEMPLATE_VAR_PATTERN, "g"), (_m, name) => {
    const value = (vars as Record<string, unknown>)[name as string];
    return value == null ? "" : String(value);
  });
}
