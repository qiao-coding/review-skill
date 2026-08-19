import { readFile } from "node:fs/promises";
import { discover } from "./discover.js";
import { parseMarkdown } from "./parse.js";
import { analyze } from "./analyze.js";
import { transformMarkdown } from "./transform.js";
import { estimateTokens } from "./tokenize.js";
import { emitRuntime, emitMetadata, emitTypesDts } from "./emit/index.js";
import { frontmatterRange, validateVariables, scanSkillRefs } from "./variables.js";
import { msg } from "../i18n.js";
import type { SkillMeta, StripOptions } from "../types.js";

export interface CompileOptions {
  /** Number of runtime lines embedded as a hover preview in the generated JSDoc. */
  previewLines?: number;
}

export interface CompileResult {
  entries: SkillMeta[];
  outputDir: string;
  sourceTokens: number;
  runtimeTokens: number;
  warnings: string[];
}

export async function compile(
  skillsDir: string,
  outputDir: string,
  strip?: StripOptions,
  lang?: string,
  opts?: CompileOptions
): Promise<CompileResult> {
  const files = await discover(skillsDir);
  const entries: SkillMeta[] = [];
  const contentMap = new Map<string, string>();
  const warnings: string[] = [];
  const errors: string[] = [];
  const previewLines = opts?.previewLines;
  const refsByFile: { relativePath: string; refs: string[] }[] = [];

  // Group by skill to count files
  const skillFileCount = new Map<string, number>();
  for (const f of files) {
    // Determine the skill this file belongs to
    const skillKey = f.isSkill
      ? (f.relativePath.replace(/\/?SKILL\.md$/, "") || "/")
      : (f.parentSkill ?? "/");
    skillFileCount.set(skillKey, (skillFileCount.get(skillKey) ?? 0) + 1);
  }

  for (const file of files) {
    const raw = await readFile(file.absolutePath, "utf-8");
    // Strip a UTF-8 BOM so remark-frontmatter still sees the `---` at offset 0.
    const sourceContent = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    const sourceChars = sourceContent.length;
    const sourceTokens = estimateTokens(sourceChars);

    const ast = parseMarkdown(sourceContent);
    const { title, description } = analyze(ast);

    // L1 variable contract — validate placeholders against frontmatter, collect across files.
    const { variables, warnings: varWarnings, errors: varErrors } = validateVariables(ast);
    for (const e of varErrors) errors.push(`${file.relativePath}: ${e}`);
    for (const w of varWarnings) warnings.push(`${file.relativePath}: ${w}`);

    // L2 `@/path` references — collected now, validated against all paths after the loop.
    refsByFile.push({ relativePath: file.relativePath, refs: scanSkillRefs(ast) });

    // Strip frontmatter at the source level before transform — transform.ts stays untouched.
    const fm = frontmatterRange(ast);
    const sourceForTransform = fm
      ? sourceContent.slice(0, fm.start) + sourceContent.slice(fm.end)
      : sourceContent;

    const runtimeContent = await transformMarkdown(sourceForTransform, strip);
    const runtimeChars = runtimeContent.length;
    const runtimeTokens = estimateTokens(runtimeChars);

    const skillPath = file.isSkill
      ? (file.relativePath.replace(/\/?SKILL\.md$/, "") === ""
          ? "/"
          : "/" + file.relativePath.replace(/\/?SKILL\.md$/, ""))
      : "/" + file.relativePath;

    const entry: SkillMeta = {
      path: skillPath,
      title: title || skillPath,
      description: description || "",
      isSkill: file.isSkill,
      source: { characters: sourceChars, tokens: sourceTokens },
      runtime: { characters: runtimeChars, tokens: runtimeTokens },
      ...(variables.length > 0 ? { variables } : {}),
    };

    // Count files per skill
    if (file.isSkill) {
      const skillKey = file.relativePath.replace(/\/?SKILL\.md$/, "") || "/";
      entry.files = skillFileCount.get(skillKey) ?? 1;
    }

    entries.push(entry);
    contentMap.set(skillPath, runtimeContent);
    await emitRuntime(skillPath, runtimeContent, outputDir);
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  // L2 — every `@/path` reference must resolve to a known skill/resource path.
  const knownPaths = new Set(entries.map((e) => e.path));
  for (const { relativePath, refs } of refsByFile) {
    for (const ref of refs) {
      if (!knownPaths.has(ref.slice(1))) {
        warnings.push(`${relativePath}: ${msg("warnUnknownRef", ref)}`);
      }
    }
  }

  await emitMetadata(entries, outputDir);
  await emitTypesDts(entries, outputDir, lang, { contentMap, previewLines });

  const sourceTokens = entries.reduce((s, e) => s + e.source.tokens, 0);
  const runtimeTokens = entries.reduce((s, e) => s + e.runtime.tokens, 0);

  return { entries, outputDir, sourceTokens, runtimeTokens, warnings };
}
