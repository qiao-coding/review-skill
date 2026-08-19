/** Lightweight i18n — detects host locale and picks the right messages. */

const messages = {
  en: {
    help: `review-skill — Compile Markdown Agent Skills

  npx review-skill Build skills for production
  npx review-skill --init       Initialize skills/ in current project
  npx review-skill --watch      Build and watch for changes

Config: skill.config.js (optional)
`,
    initCreateSkills: "Create skills/SKILL.md",
    initSkillsExists: "skills/ already exists",
    initCreateConfig: "Create skill.config.js",
    initConfigExists: "skill.config.js already exists",
    initGitignore: "Add .skill/ to .gitignore",
    initDone1: "Done. Try these commands:",
    initDone2: "  npm run skill:build      (compile once)",
    initDone3: "  npm run skill:dev        (watch mode)",
    initEsm: 'Set "type": "module" in package.json',
    initTsconfig: "Add @review-skill/skill path alias to tsconfig.json",
    initScripts: "Add scripts to package.json",
    initDependency: "Add review-skill to package.json dependencies",
    buildResult: (files: number, ms: number, skills: number, src: number, rt: number, rate: string) =>
      `Compiled ${files} files in ${ms}ms\n  ${skills} skills  |  Source ${src} → Runtime ${rt} tokens  |  -${rate}%\n`,
    watchStart: (dir: string) => `Watching ${dir}/**/*.md...\n`,
    watchRebuild: (time: string) => `[${time}] Rebuilding...`,
    errorSkillNotFound: (path: string) =>
      `Skill not found: "${path}". Run "npx review-skill" to compile.`,
    buildError: (message: string) => `\n❌ Build failed:\n  ${message}\n`,
    errorNoFrontmatter: (names: string) =>
      `Template uses undeclared variables (${names}) but the file has no frontmatter "variables" contract. Add a variables block at the very top of the file.`,
    errorUndeclared: (name: string) => `Undeclared variable {{${name}}}. Declare it in frontmatter variables or remove the placeholder.`,
    errorMalformed: (token: string) => `Malformed placeholder ${token}. Use {{camelCaseName}}.`,
    errorRequiredUnused: (name: string) => `Required variable "${name}" declared but never used in the template.`,
    warnDeclaredUnused: (name: string) => `Optional variable "${name}" declared but never used in the template.`,
    warnUnknownRef: (ref: string) => `Unknown skill reference ${ref}. Add a skill at this path or fix the reference.`,
    deprecatedStrip: (equivalent: string) =>
      `strip object form is deprecated — use the character-based token array instead:\n    strip: ${equivalent}\n  Each token is a markdown syntax literal (see review-skill types STRIP_TOKENS). Omit anything you want kept.`,
    errorFrontmatterParse: `Failed to parse YAML frontmatter.`,
    errorFrontmatterNoVariables: `frontmatter has no "variables" list.`,
    errorFrontmatterInvalidEntry: (entry: string) => `Invalid variable entry: ${entry}. Each entry needs a "name".`,
    errorFrontmatterDuplicate: (name: string) => `Duplicate variable "${name}".`,
  },

  "zh-CN": {
    help: `review-skill — Markdown Agent Skill 编译器

  npx review-skill构建 skills → .skill/
  npx review-skill --init       初始化 skills/ 目录
  npx review-skill --watch      构建并监听文件变更

配置文件: skill.config.js（可选）
`,
    initCreateSkills: "创建 skills/SKILL.md",
    initSkillsExists: "skills/ 已存在",
    initCreateConfig: "创建 skill.config.js",
    initConfigExists: "skill.config.js 已存在",
    initGitignore: ".gitignore 中加入 .skill/",
    initDone1: "完成。试试以下命令：",
    initDone2: "  npm run skill:build      (编译)",
    initDone3: "  npm run skill:dev        (监听模式)",
    initEsm: '设置 package.json 的 "type": "module"',
    initTsconfig: "添加 @review-skill/skill 路径别名到 tsconfig.json",
    initScripts: "添加 scripts 到 package.json",
    initDependency: "添加 review-skill 到 package.json 依赖",
    buildResult: (files: number, ms: number, skills: number, src: number, rt: number, rate: string) =>
      `编译了 ${files} 个文件，耗时 ${ms}ms\n  ${skills} 个 skill  |  源文件 ${src} → 运行时 ${rt} tokens  |  -${rate}%\n`,
    watchStart: (dir: string) => `正在监听 ${dir}/**/*.md...\n`,
    watchRebuild: (time: string) => `[${time}] 重新编译中...`,
    errorSkillNotFound: (path: string) =>
      `找不到 Skill: "${path}"。请运行 "npx review-skill" 编译。`,
    buildError: (message: string) => `\n❌ 编译失败:\n  ${message}\n`,
    errorNoFrontmatter: (names: string) =>
      `模板使用了未声明变量（${names}），但文件没有 frontmatter "variables" 契约。请在文件最顶部添加 variables 块。`,
    errorUndeclared: (name: string) => `未声明变量 {{${name}}}。请在 frontmatter variables 中声明它，或移除该占位符。`,
    errorMalformed: (token: string) => `畸形占位符 ${token}。请使用 {{camelCaseName}} 格式。`,
    errorRequiredUnused: (name: string) => `required 变量 "${name}" 已声明但模板未使用。`,
    warnDeclaredUnused: (name: string) => `可选变量 "${name}" 已声明但模板未使用。`,
    warnUnknownRef: (ref: string) => `未识别的 skill 引用 ${ref}。请创建该路径的 skill，或修正引用。`,
    deprecatedStrip: (equivalent: string) =>
      `strip 对象形式已弃用 —— 请改用字符 token 数组：\n    strip: ${equivalent}\n  每个 token 是 markdown 语法字面量（见 review-skill 类型 STRIP_TOKENS）。想保留的不要列。`,
    errorFrontmatterParse: `YAML frontmatter 解析失败。`,
    errorFrontmatterNoVariables: `frontmatter 中没有 "variables" 列表。`,
    errorFrontmatterInvalidEntry: (entry: string) => `无效的变量条目: ${entry}。每个条目需要 "name"。`,
    errorFrontmatterDuplicate: (name: string) => `重复的变量 "${name}"。`,
  },
};

type Lang = keyof typeof messages;
type MsgKey = keyof (typeof messages)["en"];

function detectLang(): Lang {
  // 1. Env override (LANG / LC_ALL / LC_MESSAGES)
  const env = process.env.LANG ?? process.env.LC_ALL ?? process.env.LC_MESSAGES;
  if (env) {
    if (/^zh/i.test(env)) return "zh-CN";
    if (/^en/i.test(env)) return "en";
  }
  // 2. Windows: check system UI language via Intl
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (/^zh/i.test(locale)) return "zh-CN";
  } catch { /* ignore */ }
  return "en";
}

export const lang = detectLang();
const t = messages[lang] ?? messages.en;

export function msg<K extends MsgKey>(key: K, ...args: unknown[]): string {
  const val = t[key];
  if (typeof val === "function") return (val as (...a: unknown[]) => string)(...args);
  return val as string;
}
