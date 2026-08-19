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

// POSIX path math in canonical space ("/foo/bar.md") — deliberately not
// node:path's join/normalize, which would inject backslashes on Windows.

function posixDirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i <= 0 ? "/" : path.slice(0, i);
}

function joinPosix(base: string, url: string): string {
  const parts = [...base.split("/"), ...url.split("/")];
  const out: string[] = [];
  for (const p of parts) {
    if (!p || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return "/" + out.join("/");
}

/**
 * Resolve a markdown link URL to a canonical skill path. `fromPath` is the
 * canonical path of the containing file (`/react/rules/state.md`). Because
 * source (`skills/…`) and runtime (`.skill/runtime/…`) share the same relative
 * structure, a relative link resolves identically in both — one rule for the
 * compiler and for `bundle()`.
 *
 * Returns null when the URL is not a local skill reference: external schemes,
 * protocol-relative `//`, anchors, mailto. `…/SKILL.md` → the skill path
 * (drops `/SKILL.md`); resources keep `.md`; a bare directory link stays as-is.
 */
export function resolveSkillLink(url: string, fromPath: string): string | null {
  if (!url || /^(?:https?:|mailto:|tel:|data:|#|\/\/)/.test(url)) return null;
  // Dynamic route — the path has a placeholder segment (e.g. 【xxx】 or {id}).
  // There is no static target to validate or merge: keep the link untouched so
  // the consumer can resolve the placeholder at runtime.
  if (/[【{]/.test(url)) return null;
  const resolved = url.startsWith("/") ? url : joinPosix(posixDirname(fromPath), url);
  const stripped = resolved.replace(/\/SKILL\.md$/, "");
  return stripped || "/";
}

/** Read a compiled runtime file for any path; null when it doesn't exist. */
function resolveRuntimeFile(baseDir: string, path: string): string | null {
  const clean = path.replace(/^\//, "");
  const skillPath = join(baseDir, "runtime", clean, "SKILL.md");
  if (existsSync(skillPath)) return readFileSync(skillPath, "utf-8");
  const resourcePath = join(baseDir, "runtime", clean);
  if (existsSync(resourcePath)) return readFileSync(resourcePath, "utf-8");
  return null;
}

/** `[text](url)` / `[text](url "title")` — group 1 label, group 2 url; negative lookbehind excludes `![img](url)`. */
const LINK_RE_SOURCE = "(?<!\\!)\\[([^\\]\\n]*)\\]\\(([^)\\s]+)(?:\\s+[\"'][^)]*)?\\)";

/**
 * Recursively inline markdown-link references into a single self-contained
 * document. Each `[text](../path)` is resolved relative to `currentPath` (the
 * canonical path of the file that contains it) and replaced with the referenced
 * content, wrapped in the original link as a section marker. `resolve(path)`
 * returns the referenced content (or null for unknown paths). `visited` guards
 * against reference cycles — an already-open path is replaced with a
 * `[cycle url]` marker instead of recursing forever.
 */
export function inlineRefs(
  content: string,
  currentPath: string,
  resolve: (path: string) => string | null,
  visited: ReadonlySet<string> = new Set()
): string {
  const re = new RegExp(LINK_RE_SOURCE, "g");
  return content.replace(re, (link, _label, url) => {
    const path = resolveSkillLink(url, currentPath);
    if (path == null) return link; // external/anchor — leave as-is
    if (visited.has(path)) return `[cycle ${path}]`;
    const nested = resolve(path);
    if (nested == null) return link; // unknown — leave as-is
    const nextVisited = new Set(visited).add(path);
    return `\n${link}\n${inlineRefs(nested, path, resolve, nextVisited)}\n[/${path.replace(/^\//, "")}]\n`;
  });
}

/**
 * Compile-time link absorption: replace each `[text](../path)` with the fully
 * inlined content of the referenced file (recursively), so the runtime output
 * is self-contained — no URL noise left for the agent. Cycles absorb to the
 * link label; unknown refs stay as-is (the build already warned). `resolve(path)`
 * returns the target's content (null for unknown).
 */
export function absorbLinks(
  content: string,
  currentPath: string,
  resolve: (path: string) => string | null,
  visiting: ReadonlySet<string> = new Set()
): string {
  const re = new RegExp(LINK_RE_SOURCE, "g");
  return content.replace(re, (link, label, url) => {
    const path = resolveSkillLink(url, currentPath);
    if (path == null) return link; // external/anchor — keep
    if (visiting.has(path)) return label; // cycle — absorb to plain text
    const nested = resolve(path);
    if (nested == null) return link; // unknown — keep (warned at build)
    const nextVisiting = new Set(visiting).add(path);
    return absorbLinks(nested, path, resolve, nextVisiting);
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
  // Relative links resolve against the containing file, so the base is the
  // canonical *file* path (a skill's file is `<path>/SKILL.md`), not the skill path.
  const linkBase = meta.isSkill ? `${path}/SKILL.md` : path;

  return {
    meta,
    content,
    async read(): Promise<string> {
      return content;
    },
    bundle(): string {
      return inlineRefs(content, linkBase, (p) => resolveRuntimeFile(baseDir, p));
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
