#!/usr/bin/env node
/**
 * review-skill — single-bin CLI, no heavy framework.
 */

import { compile } from "./compiler/pipeline.js";
import { mkdir, writeFile, readFile, appendFile } from "node:fs/promises";
import { existsSync, watch } from "node:fs";
import { join, resolve } from "node:path";
import { msg, lang } from "./i18n.js";

const cwd = process.cwd();
const args = process.argv.slice(2);

const isInit = args.includes("--init") || args.includes("-i");
const isWatch = args.includes("--watch") || args.includes("-w");
const isHelp = args.includes("--help") || args.includes("-h");

if (isHelp) {
  console.log(msg("help"));
  process.exit(0);
}

// ── Config loader ───────────────────────────────────────

interface SkillConfig {
  skillsDir?: string;
  outputDir?: string;
  strip?: Record<string, boolean>;
}

async function loadConfig(): Promise<SkillConfig> {
  const configPath = join(cwd, "skill.config.js");
  if (!existsSync(configPath)) return {};
  try {
    const configUrl = `file:///${configPath.replace(/\\/g, "/")}`;
    const mod = await import(configUrl);
    return (mod.default ?? mod) as SkillConfig;
  } catch {
    return {};
  }
}

// ── Init ─────────────────────────────────────────────────

if (isInit) {
  const skillsDir = join(cwd, "skills");

  if (!existsSync(skillsDir)) {
    await mkdir(skillsDir, { recursive: true });
    await writeFile(
      join(skillsDir, "SKILL.md"),
      "# My Agent Skills\n\n<!-- Add your agent instructions here -->\n\n## Overview\n\nDescribe what your agent does.\n",
      "utf-8"
    );
    console.log(`✔ ${msg("initCreateSkills")}`);
  } else {
    console.log(`○ ${msg("initSkillsExists")}`);
  }

  const configPath = join(cwd, "skill.config.js");
  if (!existsSync(configPath)) {
    await writeFile(configPath, [
      'import { defineConfig } from "review-skill";',
      "",
      "export default defineConfig({",
      '  /** Directory containing your skill markdown files */',
      '  skillsDir: "skills",',
      "",
      '  /** Output directory for compiled artifacts */',
      '  outputDir: ".skill",',
      "",
      "  /** Markdown elements to strip during compilation (all default to true) */",
      "  strip: {",
      "    comment: true,        // <!-- HTML comments -->",
      "    formatting: true,     // **bold** *italic* ~~strike~~",
      "    image: true,          // ![alt](url)",
      "    blockquote: true,     // > quotes",
      "    thematicBreak: true,  // --- horizontal rules",
      "    bullet: true,         // * - + list markers",
      "    whitespace: true,     // extra blank lines, trailing spaces",
      "  },",
      "});",
      "",
    ].join("\n"), "utf-8");
    console.log(`✔ ${msg("initCreateConfig")}`);
  } else {
    console.log(`○ ${msg("initConfigExists")}`);
  }

  const gitignorePath = join(cwd, ".gitignore");
  const line = ".skill/";
  let gitContent = "";
  if (existsSync(gitignorePath)) {
    gitContent = await readFile(gitignorePath, "utf-8");
  }
  if (!gitContent.includes(line)) {
    await appendFile(gitignorePath, (gitContent ? "\n" : "") + line + "\n", "utf-8");
    console.log(`✔ ${msg("initGitignore")}`);
  }

  // Inject scripts into package.json
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
    if (!pkg.scripts) pkg.scripts = {};
    let updated = false;
    if (!pkg.scripts["skill:build"]) {
      pkg.scripts["skill:build"] = "review-skill";
      updated = true;
    }
    if (!pkg.scripts["skill:dev"]) {
      pkg.scripts["skill:dev"] = "review-skill --watch";
      updated = true;
    }
    if (updated) {
      await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
      console.log(`✔ ${msg("initScripts")}`);
    }
  }

  console.log("");
  console.log(msg("initDone1"));
  console.log(`  ${msg("initDone2")}`);
  console.log(`  ${msg("initDone3")}`);
  process.exit(0);
}

// ── Build ────────────────────────────────────────────────

async function build() {
  const config = await loadConfig();
  const skillsDir = resolve(cwd, config.skillsDir ?? "skills");
  const outputDir = resolve(cwd, config.outputDir ?? ".skill");

  const start = Date.now();
  const result = await compile(skillsDir, outputDir, config.strip, lang);

  const skills = result.entries.filter((e) => e.isSkill);
  const reduction = result.sourceTokens - result.runtimeTokens;
  const rate = result.sourceTokens > 0
    ? ((reduction / result.sourceTokens) * 100).toFixed(1)
    : "0.0";

  console.log(msg("buildResult", result.entries.length, Date.now() - start, skills.length, result.sourceTokens, result.runtimeTokens, rate));
}

await build();

// ── Watch ────────────────────────────────────────────────

if (isWatch) {
  const config = await loadConfig();
  const skillsDir = resolve(cwd, config.skillsDir ?? "skills");

  console.log(msg("watchStart", skillsDir));

  let timer: ReturnType<typeof setTimeout> | null = null;

  watch(skillsDir, { recursive: true }, (_event, filename) => {
    if (!filename?.endsWith(".md")) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      console.log(msg("watchRebuild", new Date().toLocaleTimeString()));
      await build();
    }, 200);
  });
}
