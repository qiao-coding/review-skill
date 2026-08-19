import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { SkillMeta, VariableDecl } from "../../types.js";

const LABELS: Record<string, Record<string, string>> = {
  en: {
    sourceTitle: "── Current file ──",
    runtimeTitle: "── Estimated after build ──",
    files: "Files",
    characters: "Chars",
    tokens: "Tokens",
    previewTitle: "Content preview",
  },
  "zh-CN": {
    sourceTitle: "── 当前文件 ──",
    runtimeTitle: "── 预计编译后 ──",
    files: "文件数",
    characters: "字符数",
    tokens: "Token",
    previewTitle: "内容预览",
  },
};

export interface EmitTypesDtsOptions {
  /** skillPath → compiled runtime content — drives the hover preview block. */
  contentMap?: Map<string, string>;
  /** Max runtime lines embedded per JSDoc preview. Default 3. */
  previewLines?: number;
}

/** "/galgame/section-plan" → "GalgameSectionPlanVars"; "/" → "RootVars". */
function pathToVarsType(path: string, used: Set<string>): string {
  const segs = path
    .replace(/\.md$/, "")
    .split("/")
    .filter(Boolean)
    .map((seg) => {
      const cleaned = seg.replace(/[^A-Za-z0-9_]/g, "");
      return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "";
    })
    .filter(Boolean);
  let base = segs.length > 0 ? `${segs.join("")}Vars` : "RootVars";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(base)) {
    // Non-ASCII / odd paths → deterministic hash-based name.
    let h = 0;
    for (const ch of path) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    base = `SkillVars_${h.toString(36)}`;
  }
  while (used.has(base)) base += "2";
  used.add(base);
  return base;
}

function varsFields(vars: VariableDecl[]): string {
  return vars.map((v) => `  ${v.name}${v.required ? "" : "?"}: string;`).join("\n");
}

/**
 * Generate `.skill/skill.ts` — a wrapper module that adds typed overloads
 * to skill() with JSDoc hover info, per-skill variable interfaces,
 * and a re-export of the runtime `inject`.
 */
export async function emitTypesDts(
  entries: SkillMeta[],
  outputDir: string,
  lang: string = "en",
  opts?: EmitTypesDtsOptions
): Promise<void> {
  const L = LABELS[lang] ?? LABELS.en;
  const skills = entries.filter((e) => e.isSkill);
  const resources = entries.filter((e) => !e.isSkill);

  const sorted = [...entries].sort((a, b) => {
    if (a.path === "/") return -1;
    if (b.path === "/") return 1;
    return a.path.length - b.path.length || a.path.localeCompare(b.path);
  });

  function formatUnion(items: string[]): string[] {
    if (items.length === 0) return ["  never;"];
    return items.map((item, i) => {
      const suffix = i === items.length - 1 ? ";" : "";
      return `  | ${item}${suffix}`;
    });
  }

  function buildPreview(content: string, n: number): string[] {
    const contentLines = content.split("\n");
    const total = content.endsWith("\n") ? contentLines.length - 1 : contentLines.length;
    const shown = contentLines.slice(0, n).map((l) => l.replace(/\*\//g, "*\\/"));
    const zh = lang === "zh-CN";
    const out: string[] = [" *"];
    out.push(
      zh
        ? ` * ── ${L.previewTitle}（前 ${shown.length} 行）──`
        : ` * ── ${L.previewTitle} (first ${shown.length}) ──`
    );
    for (const l of shown) out.push(` * ${l}`);
    if (total > shown.length) {
      out.push(zh ? ` * …（共 ${total} 行）` : ` * … (${total} lines total)`);
    }
    return out;
  }

  function jsDoc(entry: SkillMeta): string {
    const kind = entry.isSkill ? "Skill" : "Resource";

    const sourceFile = entry.isSkill
      ? `skills/${entry.path === "/" ? "" : entry.path.replace(/^\//, "")}/SKILL.md`.replace(/\/$/, "/SKILL.md").replace(/\/\//g, "/")
      : `skills/${entry.path.replace(/^\//, "")}`;

    const lines: string[] = ["/**"];

    lines.push(` * **${entry.title || entry.path}**`);
    if (entry.description) {
      lines.push(` *`);
      lines.push(` * ${entry.description}`);
    }
    lines.push(` *`);
    lines.push(` * \`skill(${JSON.stringify(entry.path)})\`  →  ${kind}`);
    lines.push(` *`);
    lines.push(` * 📄 ${sourceFile}`);
    lines.push(` *`);
    const sc = entry.source.characters;
    const rc = entry.runtime.characters;
    const sr = entry.source.tokens;
    const rt = entry.runtime.tokens;
    const cpct = sc > 0 ? ((1 - rc / sc) * 100).toFixed(1) : "0.0";
    const tpct = sr > 0 ? ((1 - rt / sr) * 100).toFixed(1) : "0.0";

    const cs = rc < sc ? `-${cpct}` : `+${cpct}`;
    const ts = rt < sr ? `-${tpct}` : `+${tpct}`;

    const srcTitle = L.sourceTitle.replace(/^── /, "").replace(/ ──$/, "");
    const rtTitle = L.runtimeTitle.replace(/^── /, "").replace(/ ──$/, "");

    lines.push(` *`);
    lines.push(` * **${srcTitle}** | ${L.characters} \`${sc.toLocaleString()}\` | ${L.tokens} \`~${sr.toLocaleString()}\`  `);
    lines.push(` *`);
    lines.push(` * **${rtTitle}** | ${L.characters} \`${rc.toLocaleString()}\` (\`${cs}%\`) | ${L.tokens} \`~${rt.toLocaleString()}\` (\`${ts}%\`)`);

    // L4 — hover content preview from the compiled runtime.
    const preview = opts?.contentMap?.get(entry.path);
    if (preview && preview.trim()) {
      lines.push(...buildPreview(preview, opts?.previewLines ?? 3));
    }

    lines.push(" */");
    return lines.join("\n");
  }

  const lines: string[] = [
    "// Generated by review-skill compiler. DO NOT EDIT.",
    "",
    "/* eslint-disable */",
    "",
    'import { skill as _skill, loadMetadata } from "review-skill";',
    'export type { SkillRef, SkillMeta, SkillStats } from "review-skill";',
    'export { inject } from "review-skill";',
    'export type { VariableDecl } from "review-skill";',
    "",
    'const _meta = loadMetadata(".skill");',
    "",
    "export type SkillPath =",
    ...formatUnion(skills.map((s) => JSON.stringify(s.path))),
    "",
    "export type ResourcePath =",
    ...formatUnion(resources.map((s) => JSON.stringify(s.path))),
    "",
    "export type SkillAddress = SkillPath | ResourcePath;",
    "",
  ];

  // Per-skill variable interfaces, generated from each frontmatter contract.
  const usedTypeNames = new Set<string>();
  for (const entry of sorted) {
    if (!entry.variables?.length) continue;
    const name = pathToVarsType(entry.path, usedTypeNames);
    lines.push(`/** Variables for ${JSON.stringify(entry.path)} */`);
    lines.push(`export interface ${name} {`);
    lines.push(varsFields(entry.variables));
    lines.push(`}`);
    lines.push("");
  }

  for (const entry of sorted) {
    lines.push(jsDoc(entry));
    lines.push(
      `export function skill(path: ${JSON.stringify(entry.path)}): import("review-skill").SkillRef;`
    );
    lines.push("");
  }

  lines.push("/** Fallback — unknown path */");
  lines.push('export function skill(path: string): import("review-skill").SkillRef;');
  lines.push("");

  // Runtime implementation — delegates to review-skill
  lines.push("export function skill(path: string): import(\"review-skill\").SkillRef {");
  lines.push('  return _skill(path);');
  lines.push("}");
  lines.push("");

  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "skill.ts"), lines.join("\n"), "utf-8");
}
