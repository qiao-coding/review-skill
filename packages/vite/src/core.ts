/**
 * Pure logic for the review-skill Vite plugin — no `vite` import, so the
 * resolution/reading/compile-check behavior is unit-testable on its own.
 *
 * The plugin turns compiled skills (`.skill/metadata.json` + `.skill/runtime/`)
 * into first-class modules: `@skill/meta` and `@skill/<path>`.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { inlineRefs } from "review-skill";
import type { SkillMeta } from "review-skill";

export interface SkillFrameworkOptions {
  /** Directory of source SKILL.md files. Defaults to `skills`. */
  skillsDir?: string;
  /** Compiler output directory. Defaults to `.skill`. */
  outputDir?: string;
}

export const VIRTUAL_PREFIX = "@skill";
export const META_ID = "\0@skill/meta";
export const RESOURCE_PREFIX = "\0@skill/";

export function resolveOutputDir(cwd: string, opts: SkillFrameworkOptions = {}): string {
  return resolve(cwd, opts.outputDir ?? ".skill");
}

export function resolveSkillsDir(cwd: string, opts: SkillFrameworkOptions = {}): string {
  return resolve(cwd, opts.skillsDir ?? "skills");
}

function collectMarkdown(dir: string, acc: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectMarkdown(full, acc);
    else if (entry.isFile() && entry.name.endsWith(".md")) acc.push(full);
  }
}

/**
 * True when the compiled metadata is missing or older than any source markdown.
 * The compiler runs first in dev/build; this avoids recompiling on every start.
 */
export function needsCompile(cwd: string, opts: SkillFrameworkOptions = {}): boolean {
  const metaPath = join(resolveOutputDir(cwd, opts), "metadata.json");
  if (!existsSync(metaPath)) return true;
  const metaTime = statSync(metaPath).mtimeMs;
  const sources: string[] = [];
  collectMarkdown(resolveSkillsDir(cwd, opts), sources);
  return sources.some((f) => statSync(f).mtimeMs > metaTime);
}

/** Map a user-facing specifier to the virtual module id; null when not ours. */
export function resolveVirtualId(id: string): string | null {
  if (id === `${VIRTUAL_PREFIX}/meta`) return META_ID;
  if (id.startsWith(`${VIRTUAL_PREFIX}/`)) return `${RESOURCE_PREFIX}${id.slice(VIRTUAL_PREFIX.length)}`;
  return null;
}

/** Load compiled skills metadata. Empty when the project hasn't been built yet. */
export function loadMeta(cwd: string, opts: SkillFrameworkOptions = {}): SkillMeta[] {
  try {
    return JSON.parse(
      readFileSync(join(resolveOutputDir(cwd, opts), "metadata.json"), "utf-8")
    ) as SkillMeta[];
  } catch {
    return [];
  }
}

/** Read a compiled runtime file under `outputDir/runtime`; null when missing. */
export function readRuntime(runtimeRoot: string, path: string): string | null {
  const clean = path.replace(/^\//, "");
  const skillPath = join(runtimeRoot, clean, "SKILL.md");
  if (existsSync(skillPath)) return readFileSync(skillPath, "utf-8");
  const resourcePath = join(runtimeRoot, clean);
  if (existsSync(resourcePath)) return readFileSync(resourcePath, "utf-8");
  return null;
}

/** ESM source for a skill/resource module — runtime content with refs inlined. */
export function moduleForResource(runtimeRoot: string, path: string): string {
  const content = readRuntime(runtimeRoot, path);
  if (content == null) return `export default ${JSON.stringify("")};\n// not found: @skill${path}\n`;
  const bundled = inlineRefs(content, path, (p) => readRuntime(runtimeRoot, p));
  return `export default ${JSON.stringify(bundled)};\n`;
}

/** ESM source for the metadata module. */
export function moduleForMeta(meta: SkillMeta[]): string {
  return `export default ${JSON.stringify(meta)};\n`;
}
