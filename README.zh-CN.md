# review-skill

TypeScript-first Skill 框架 — 用 Markdown 编写 skill，编译一次，以类型化导入消费。类型安全引用、Token 统计、零 IDE 插件。

![review-skill 项目概览](assets/review-skill-overview.png)

语言：[English](README.md) | 简体中文

---

- [概览](#概览)
- [快速开始](#快速开始)
- [编写 skill](#编写-skill)
- [编译与配置](#编译与配置)
- [消费 skill](#消费-skill)
- [接入](#接入)
- [链接与许可](#链接与许可)

---

## 概览

`review-skill` 帮开发者把 Agent 指令当成工程资产来管理：用 Markdown 编写可复用 skill，编译一次，再通过类型化导入在 TypeScript 中消费。自动补全、hover 元信息、token 统计、编译期引用校验，全部来自编译器——无需 IDE 插件。

```
你写的 Markdown               review-skill 编译            agent 读取
skills/                        ↓                           .skill/runtime/
  SKILL.md          →          token 最优运行时              system prompt
  review/rules.md   →          类型化导入                    rules.content
```

### 框架分层

一个数据源（`.skill/`）喂饱三层：

| 层 | 命令 / 包 | 你得到什么 |
|---|---|---|
| **编译器** | `npx review-skill` | `skills/*.md` → 省 token 的 `.skill/` 运行时；链接引用编译期校验；`--init` 零手动配置初始化项目 |
| **运行时** | `@review-skill/skill` | 类型化 `skill("/path")` 导入、hover 元信息、token 统计、`bundle()` 单上下文、类型化 `inject()` 模板 |
| **集成** | `@review-skill/vite` | skill 变成一等公民的 `@skill/*` 虚拟模块；插件按需自动编译 |

其他工具把 Markdown 注入 AGENTS.md 或生成独立 agent。review-skill 面向 TypeScript 开发者，把 skill 当成代码依赖来追踪——每一层的编辑器体验都是原生 markdown 链接。

## 快速开始

### 1. 初始化——无需手动配置

```bash
npx review-skill --init
npm install
```

`--init` 会脚手架出 `skills/`、配置文件、`@review-skill/skill` TypeScript 路径别名、npm scripts，并把 `review-skill` 加进你的 dependencies。

### 2. 编写 skill

Skill 可以用普通链接引用其他 skill，也可以用变量插值：

```markdown
---
variables:
  - name: focus
---
# React Code Review

You are an expert React reviewer. Focus on {{focus}}.

See [state rules](../react/rules/state.md) for state management.
```

### 3. 编译

```bash
npx review-skill
```

```text
Compiled 6 files in 91ms
  3 skills | Source 2145 -> Runtime 1751 tokens | -18.4%
```

### 4. 消费

```ts
import { skill, inject } from "@review-skill/skill";

const rules = skill("/react/rules/state.md");
const review = inject(rules.content, { focus: "state management" });
```

## 编写 skill

```
skills/
|-- SKILL.md
|-- react/
|   |-- SKILL.md
|   `-- rules/
|       |-- effects.md
|       `-- state.md
`-- security/
    |-- SKILL.md
    `-- owasp.md
```

源 Markdown 保持可读——注释、格式、表格、内部说明都留着。编译时剥离噪声（见 [编译与配置](#编译与配置)），运行时更精简。

### 引用——原生 markdown 链接

用**普通 markdown 链接**引用其他 skill，按所在文件的相对位置解析：

```markdown
Follow the security constraints in [security](../security/SKILL.md) before drafting.
```

编辑器侧由 VS Code 原生处理——输入即路径补全、Ctrl+点击跳转（含代码文件）、Ctrl+悬停预览、预览里渲染链接。无需扩展、无需配置、无需插件。

编译器把这些链接当作引用契约：

- **编译期校验**——目标解析不到已知 skill/resource 的链接会给出警告（`Unknown skill reference /path`）。
- **`bundle()`**——把链接内容递归内联成单个自包含上下文（`[text](../path)` … `[/path]` 分段，循环用 `[cycle path]` 标记守护）。
- 外部 URL（`https://`）、锚点、`mailto:`、图片（`![alt](url)`）永远不会被当作引用。

> 注意：引用式链接语法（`[x][id]` + `[id]: url`）暂不支持扫描——请使用内联 `[x](../path)` 形式。

### 模板——{{变量}} + inject()

Skill 可以是模板。在 frontmatter 里声明 `variables` 契约，prose 里用 `{{占位符}}`：

```markdown
---
variables:
  - name: sceneTitle
  - name: isFinale
    required: false
---
# Scene Plan

You are writing {{sceneTitle}}. Finale: {{isFinale}}.
```

- `required` 默认 `true`；可选变量设 `required: false`。
- 编译器在构建时强制契约：未声明的 `{{var}}` → **报错**；required 变量声明未用 → 报错；可选变量声明未用 → 警告；畸形占位符（`{{a-b}}`）→ 报错；没有 frontmatter 契约却用了任何 `{{var}}` → 报错。
- 用类型化 `inject()` 消费（见 [消费 skill](#消费-skill)）——编译器生成 per-skill 接口，缺 required key 编译期报错。

## 编译与配置

### CLI

```bash
npx review-skill            # 编译一次
npx review-skill --watch    # 监听变更自动重建
npx review-skill --init     # 初始化新项目
```

编译不需要配置文件——默认 `skills/` → `.skill/`。产物：

| 文件 | 内容 |
|---|---|
| `.skill/runtime/**` | 每个 skill/resource 的编译后 Markdown |
| `.skill/metadata.json` | 标题、描述、token 统计、变量契约 |
| `.skill/skill.ts` | 类型化 `skill()` 声明 + per-skill 变量接口 |

### strip —— token 优化

`skill.config.js` / `skill.config.mjs` 控制编译时清理哪些元素。`strip` 是**基于字符的 token 数组**：列出想剥离的精确 markdown 语法字面量（每个都有 TS 自动补全），省略即保留。**完全不配置 `strip` = 不剥离任何内容，原样返回文件**：

```js
import { defineConfig } from "review-skill";

export default defineConfig({
  skillsDir: "skills",
  outputDir: ".skill",
  // 想保留的条目删掉；完全省略 strip 则原样返回：
  strip: [
    "<!-- HTML -->", // HTML 注释
    "**bold**",       // 粗体
    "*italic*",       // 斜体
    "~~strikethrough~~",
    "![alt](url)",    // 图片
    "> quote",        // 引用块
    "---",            // 分隔线
    "- item",         // 列表符号
    "\n\n",           // 空行折叠
  ],
});
```

可用 token（见 `STRIP_TOKENS`）：`"<!-- HTML -->"` HTML 注释 · `"**bold**"` 粗体 · `"*italic*"` 斜体 · `"~~strikethrough~~"` 删除线 · `"![alt](url)"` 图片 · `"> quote"` 引用块 · `"---"` 分隔线 · `"- item"` 列表符号 · `"\n\n"` 空行折叠。空数组 `strip: []` 不剥离任何内容。

旧的对象形式（`strip: { formatting: false }`）仍可用但已弃用——编译器会提示等价的 token 数组。迁移指南：[docs/strip.md](docs/strip.md)。

## 消费 skill

### skill() —— 类型化导入

![Skill 路径自动补全](assets/router-tip.png)

编译后，每个 skill/resource 路径都有自动补全——不再手写脆弱的相对路径：

```ts
import { skill } from "@review-skill/skill";

const root = skill("/");
const rules = skill("/react/rules/state.md");

console.log(rules.meta.title);           // "React State Rules"
console.log(rules.meta.runtime.tokens);  // 运行时 token 数
const markdown = rules.content;
```

### hover 元信息

![Skill TypeScript 悬浮提示元信息和 token 统计](assets/hover-tip.png)

悬停 `skill()` 调用，可以看到标题、描述、源文件、当前字符/token、预计编译后大小和节省比例。

### bundle() —— 单个自包含上下文

```ts
const review = skill("/react");
const context = review.bundle(); // markdown 链接递归内联
```

### inject() —— 类型化模板

声明了 `variables` 契约的 skill，编译器会在 `.skill/skill.ts` 里生成 per-skill 接口（`/galgame/section-plan` → `GalgameSectionplanVars`）。缺 required key 编译期就报错：

```ts
import { skill, inject, type GalgameSectionplanVars } from "@review-skill/skill";

const scene = inject<GalgameSectionplanVars>(skill("/galgame/section-plan").content, {
  sceneTitle: "Act 2",
  // isFinale 可选 —— 可以省略
});
// 省略 sceneTitle → TS 报错: property 'sceneTitle' is missing
```

## 接入

### Agent 框架

编译后的资源就是普通 Markdown 字符串，可作 system prompt、developer instruction、工具规则、审查策略或 RAG 片段。

#### LangChain

```ts
import { ChatOpenAI } from "@langchain/openai";
import { skill } from "@review-skill/skill";

const rules = skill("/react/rules/state.md");
const llm = new ChatOpenAI({ model: "gpt-4o" });

const result = await llm.invoke([
  { role: "system", content: rules.content },
  { role: "user", content: `Review this code:\n\`\`\`tsx\n${userCode}\n\`\`\`` },
]);
```

#### Mastra

```ts
import { Agent } from "@mastra/core";
import { skill } from "@review-skill/skill";

const agent = new Agent({
  name: skill("/react").meta.title,
  instructions: skill("/react/rules/state.md").content,
  model: "openai/gpt-4o",
});
```

#### Vercel AI SDK

```ts
import { generateText } from "ai";
import { skill } from "@review-skill/skill";

const { text } = await generateText({
  model: "openai/gpt-4o",
  system: skill("/react/rules/state.md").content,
  prompt: `Review this code:\n${code}`,
});
```

#### OpenAI SDK

```ts
import OpenAI from "openai";
import { skill } from "@review-skill/skill";

const client = new OpenAI();
const response = await client.responses.create({
  model: "gpt-4.1",
  input: [
    { role: "developer", content: skill("/react/rules/state.md").content },
    { role: "user", content: `Review this code:\n${code}` },
  ],
});
```

#### 自定义 Agent

```ts
import { skill } from "@review-skill/skill";

const guide = skill("/security/owasp.md");
agent.setSystemPrompt(guide.content);
```

### @review-skill/vite

Skill 变成一等公民模块：`@skill/meta` 和 `@skill/<path>`，由插件自动编译。

```ts
// vite.config.ts
import { skillFramework } from "@review-skill/vite";
export default defineConfig({ plugins: [skillFramework()] });
```

```ts
import plan from "@skill/galgame/section-plan"; // 编译后 runtime，链接已内联
import meta from "@skill/meta";                 // metadata.json 作为 SkillMeta[]
```

metadata 缺失或比任何源文件旧时，插件会自动重新编译；`@skill/*` 模块类型通过 `@review-skill/vite/client` 暴露。

## 链接与许可

- [GitHub](https://github.com/qiao-coding/review-skill)
- [npm](https://www.npmjs.com/package/review-skill)
- [@review-skill/vite on npm](https://www.npmjs.com/package/@review-skill/vite)

MIT
