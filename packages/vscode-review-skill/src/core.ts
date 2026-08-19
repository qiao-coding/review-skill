/**
 * Pure helpers for the Review Skill Tip extension — no `vscode` imports so the
 * logic is unit-testable. Data comes from the compiled `.skill/` output, which
 * is exactly the artifact the review-skill compiler already produces.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface SkillEntry {
  path: string;
  title: string;
  description: string;
  isSkill: boolean;
}

/** `@/path` mention shape — mirrors review-skill's SKILL_REF_PATTERN. */
export const MENTION_RE = /@\/[\w/.-]*/;

/** Load compiled skills metadata. Empty when the project hasn't been built yet. */
export function loadSkills(root: string): SkillEntry[] {
  try {
    return JSON.parse(
      readFileSync(join(root, ".skill", "metadata.json"), "utf-8")
    ) as SkillEntry[];
  } catch {
    return [];
  }
}

/** Resolve the compiled runtime content for a path; null when missing. */
export function resolveRuntimeFile(root: string, path: string, isSkill: boolean): string | null {
  const clean = path.replace(/^\//, "");
  const skillPath = join(root, ".skill", "runtime", clean, "SKILL.md");
  if (existsSync(skillPath)) return readFileSync(skillPath, "utf-8");
  const resourcePath = join(root, ".skill", "runtime", clean);
  if (existsSync(resourcePath)) return readFileSync(resourcePath, "utf-8");
  return null;
}

/** First `max` lines of runtime content as a hover preview. */
export function previewLines(content: string, max: number): string {
  const all = content.split("\n");
  const total = content.endsWith("\n") ? all.length - 1 : all.length;
  const shown = all.slice(0, max);
  // drop the empty element the trailing "\n" produced
  if (shown[shown.length - 1] === "" && shown.length > 1) shown.pop();
  const preview = shown.join("\n");
  return total > max ? `${preview}\n…（共 ${total} 行）` : preview;
}

/** `@/path` mention → path (strip the leading `@`). */
export function mentionToPath(mention: string): string {
  return mention.startsWith("@") ? mention.slice(1) : mention;
}
