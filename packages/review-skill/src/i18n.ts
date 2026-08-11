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
    initTsconfig: "Add @skill path alias to tsconfig.json",
    initScripts: "Add scripts to package.json",
    buildResult: (files: number, ms: number, skills: number, src: number, rt: number, rate: string) =>
      `Compiled ${files} files in ${ms}ms\n  ${skills} skills  |  Source ${src} → Runtime ${rt} tokens  |  -${rate}%\n`,
    watchStart: (dir: string) => `Watching ${dir}/**/*.md...\n`,
    watchRebuild: (time: string) => `[${time}] Rebuilding...`,
    errorSkillNotFound: (path: string) =>
      `Skill not found: "${path}". Run "npx review-skill" to compile.`,
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
    initTsconfig: "添加 @skill 路径别名到 tsconfig.json",
    initScripts: "添加 scripts 到 package.json",
    buildResult: (files: number, ms: number, skills: number, src: number, rt: number, rate: string) =>
      `编译了 ${files} 个文件，耗时 ${ms}ms\n  ${skills} 个 skill  |  源文件 ${src} → 运行时 ${rt} tokens  |  -${rate}%\n`,
    watchStart: (dir: string) => `正在监听 ${dir}/**/*.md...\n`,
    watchRebuild: (time: string) => `[${time}] 重新编译中...`,
    errorSkillNotFound: (path: string) =>
      `找不到 Skill: "${path}"。请运行 "npx review-skill" 编译。`,
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
