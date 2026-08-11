# review-skill：让 Agent Skill 像 npm 包一样可追踪，Token 消耗一目了然

## 背景

如果你在开发 AI Agent 项目，大概率会这样管理 prompt 指令：

```
skills/
├── review/
│   ├── SKILL.md          ← 代码审查规则
│   └── rules.md          ← 详细规则
└── security/
    └── SKILL.md          ← 安全检查
```

然后用 `readFile("../../../skills/review/rules.md")` 加载到 system prompt。

这个模式有三个痛点：

1. **引用不安全** — 文件改名了，`readFile` 不报错，运行时 404
2. **Token 浪费** — 开发注释、加粗标记、空行全塞进 LLM 上下文，白白烧钱
3. **成本不可见** — 不知道一个 skill 到底消耗多少 token

于是我写了一个小工具 —— **review-skill**。

---

## 一句话

**把 Markdown Skill 编译成类型安全、Token 可度量的运行时产物。**

```bash
npm install review-skill
npx review-skill --init        # 6 个自动配置，3 秒完成
```

---

## 核心体验

初始化之后，写 skill、编译、一行导入——IDE 自动补全路径，Hover 显示 Token 消耗：

```ts
import { skill } from "@review-skill/skill";

const review = skill("/review");              // IDE 自动补全
const rules  = skill("/review/rules.md");     // Hover 显示 Token 统计

console.log(rules.meta.title);          // "React State Rules"
console.log(rules.meta.runtime.tokens); // 249

const content = await rules.read();     // 编译后的 Markdown
```

`@review-skill/skill` 是 `--init` 自动配好的 tsconfig 路径别名，不管代码在项目哪个目录都能用：

```
src/index.ts          → import { skill } from "@review-skill/skill"
src/agent/review.ts   → import { skill } from "@review-skill/skill"
src/deep/nested.ts    → import { skill } from "@review-skill/skill"
```

类型补全、Hover 全靠 TypeScript Language Service，**零插件**。

---

## 三个核心能力

### 1. 类型安全的引用

输入 `skill("/` 时 IDE 自动列出所有可用路径。Hover 显示完整信息：

```
React Code Review
skill("/react")  →  Skill
📄 skills/react/SKILL.md

── 编译前 ──
  • 文件数      1
  • 字符数      1,878
  • Token      ~470

── 编译后 ──
  • 核心       ~388
  • 常用       ~388
  • P95        ~466
  • 最大       ~582
```

写错路径直接报类型错误，不需要等到运行时才发现。

### 2. 编译优化

构建时自动清除 7 类 prompt 噪声：

| 清除项 | 效果 |
|--------|------|
| `<!-- HTML注释 -->` | 删除 |
| `**加粗**` `*斜体*` `~~删除线~~` | 去格式 |
| `![图片](url)` | 删除 |
| `> 引用块` | 去前缀 |
| `---` `***` 分割线 | 删除 |
| `*` `-` 列表子弹符 | 删除 |
| 多余空行、行尾空格 | 压缩 |

代码块内的内容**完全保护**，代码示例原样保留。

### 3. Token 可见

每次编译输出统计：

```
编译了 6 个文件，耗时 91ms
  3 个 skill  |  源文件 2145 → 运行时 1751 tokens  |  -18.4%
```

---

## 怎么用

### 初始化

```bash
npx review-skill --init
```

一步完成六个自动配置：
- 创建 `skills/SKILL.md` 模板
- 生成 `skill.config.js` 配置文件
- 配置 tsconfig 路径别名 `@review-skill/skill`
- 设置 `package.json` 为 `"type": "module"`
- 添加 `npm run skill:build` 和 `npm run skill:dev` 脚本
- `.gitignore` 加入 `.skill/`

### 编写 + 编译

```bash
npm run skill:build     # 一次性编译
npm run skill:dev       # 监听模式，修改自动编译
```

### 接入 Agent 框架

编译产物是标准 Markdown，直接塞给 LLM：

```ts
import { skill } from "@review-skill/skill";

const rules = skill("/review/rules.md");

// LangChain
const llm = new ChatOpenAI({ model: "gpt-4o" });
await llm.invoke([
  { role: "system", content: await rules.read() },
  { role: "user", content: "审查这段代码：..." },
]);

// Mastra
const agent = new Agent({
  instructions: await rules.read(),
  model: "openai/gpt-4o",
});

// Vercel AI SDK
const { text } = await generateText({
  system: await rules.read(),
  prompt: "...",
});
```

不需要 adapter。

---

## 配置

`skill.config.js`，每个清除项可以独立开关：

```js
import { defineConfig } from "review-skill";

export default defineConfig({
  skillsDir: "skills",
  outputDir: ".skill",
  strip: {
    comment: true,        // <!-- HTML注释 -->
    formatting: true,     // **粗体** *斜体*
    image: true,          // ![图片]
    blockquote: true,     // > 引用
    thematicBreak: true,  // --- 分割线
    bullet: true,         // * - 列表符
    whitespace: true,     // 多余空行
  },
});
```

想保留哪个格式，设为 `false` 就行。

---

## 工作原理

```
skills/                     ← 你写的（有注释、有空行）
    │
    │  review-skill build
    ▼
.skill/
├── runtime/                ← LLM 读的（去噪、压缩）
├── metadata.json           ← 统计数据
└── skill.ts                ← 生成的包装函数（类型重载 + JSDoc）
```

- 编译器用 `unified` + `remark` 做 Markdown AST 精确操作
- 类型生成用 TypeScript 函数重载 + JSDoc，IDE 原生渲染
- `esbuild` 打包发布，整个包 14KB

---

## 链接

- GitHub: [qiao-coding/review-skill](https://github.com/qiao-coding/review-skill)
- npm: [review-skill](https://www.npmjs.com/package/review-skill)

---

*有用的话欢迎 Star ⭐️*
