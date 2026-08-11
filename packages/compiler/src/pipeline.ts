import { readFile } from "node:fs/promises";
import { discover } from "./discover.js";
import { parseMarkdown } from "./parse.js";
import { analyze } from "./analyze.js";
import { transformMarkdown } from "./transform.js";
import { estimateTokens } from "./tokenize.js";
import { emitRuntime, emitMetadata, emitTypesDts } from "./emit/index.js";
import type { SkillMeta, StripOptions } from "@qiao-coding/skill-core";

export interface CompileResult {
  entries: SkillMeta[];
  outputDir: string;
  sourceTokens: number;
  runtimeTokens: number;
}

export async function compile(
  skillsDir: string,
  outputDir: string,
  strip?: StripOptions,
  lang?: string
): Promise<CompileResult> {
  const files = await discover(skillsDir);
  const entries: SkillMeta[] = [];

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
    const sourceContent = await readFile(file.absolutePath, "utf-8");
    const sourceChars = sourceContent.length;
    const sourceTokens = estimateTokens(sourceChars);

    const ast = parseMarkdown(sourceContent);
    const { title, description, headingTree } = analyze(ast);

    const runtimeContent = await transformMarkdown(sourceContent, strip);
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
    };

    // Add aggregate stats for skills
    if (file.isSkill) {
      const skillKey = file.relativePath.replace(/\/?SKILL\.md$/, "") || "/";
      const fileCount = skillFileCount.get(skillKey) ?? 1;
      entry.files = fileCount;
      entry.typical = runtimeTokens;
      entry.p95 = Math.round(runtimeTokens * 1.2);
      entry.max = Math.round(runtimeTokens * 1.5);
    }

    entries.push(entry);
    await emitRuntime(skillPath, runtimeContent, outputDir);
  }

  await emitMetadata(entries, outputDir);
  await emitTypesDts(entries, outputDir, lang);

  const sourceTokens = entries.reduce((s, e) => s + e.source.tokens, 0);
  const runtimeTokens = entries.reduce((s, e) => s + e.runtime.tokens, 0);

  return { entries, outputDir, sourceTokens, runtimeTokens };
}
