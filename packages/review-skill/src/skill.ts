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

/**
 * Shared `@/path` reference pattern — single source for both the compiler
 * (scanning/validation in variables.ts) and the runtime `inlineRefs`.
 * Matches `@/path`, `@/path/to/resource.md`, and bare `@/` (root skill);
 * `@`-without-slash (`@user`) is never a reference.
 */
export const SKILL_REF_PATTERN = "(?<!\\w)@\\/(?:[A-Za-z0-9_/-]+(?:\\.md)?)?";

/** Read a compiled runtime file for any path; null when it doesn't exist. */
function resolveRuntimeFile(baseDir: string, path: string): string | null {
  const clean = path.replace(/^\//, "");
  const skillPath = join(baseDir, "runtime", clean, "SKILL.md");
  if (existsSync(skillPath)) return readFileSync(skillPath, "utf-8");
  const resourcePath = join(baseDir, "runtime", clean);
  if (existsSync(resourcePath)) return readFileSync(resourcePath, "utf-8");
  return null;
}

/**
 * Recursively inline `@/path` references into a single self-contained document.
 * `resolve(path)` returns the referenced content (or null for unknown paths).
 * `visited` guards against reference cycles — an already-open path is replaced
 * with a `[cycle @/path]` marker instead of recursing forever.
 */
export function inlineRefs(
  content: string,
  resolve: (path: string) => string | null,
  visited: ReadonlySet<string> = new Set()
): string {
  const re = new RegExp(SKILL_REF_PATTERN, "g");
  return content.replace(re, (mention) => {
    const path = mention.slice(1); // strip "@" → "/path"
    if (visited.has(path)) return `[cycle ${mention}]`;
    const nested = resolve(path);
    if (nested == null) return mention; // unknown — leave as-is
    const nextVisited = new Set(visited).add(path);
    return `\n[${mention}]\n${inlineRefs(nested, resolve, nextVisited)}\n[/${mention}]\n`;
  });
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
    bundle(): string {
      return inlineRefs(content, (p) => resolveRuntimeFile(baseDir, p));
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
