# review-skill：让 Agent Skill 像 npm 包一样可追踪，Token 消耗一目了然

## 背景

如果你在开发 AI Agent 项目，大概率会这样组织 prompt 指令：

```
skills/
├── review/
│   ├── SKILL.md          ← 代码审查规则
│   └── rules.md          ← 详细规则
└── security/
    └── SKILL.md          ← 安全检查
```

然后用 `readFile("../../../skills/review/rules.md")` 加载到 system prompt 里。

这个模式有三个痛点：

1. **路径不安全** — 文件改名了，`readFile` 不会报错，运行时才发现路径404
2. **Token 浪费** — 开发注释、加粗标记、空行全塞进 LLM 上下文，白白烧钱
3. **成本不可见** — 不知道一个 skill 到底消耗多少 token

于是我写了一个小工具来解决 —— **review-skill**。

---

## 它做什么

一句话：**把 Markdown Skill 编译成类型安全、Token 可度量的运行时产物。**

```bash
npm install review-skill
npx review-skill --init     # 初始化
npx review-skill            # 编译
```

编译前后对比：

```
skills/SKILL.md (1,345 字符)     →    .skill/runtime/SKILL.md (855 字符)
  ├── <!-- TODO: xxx -->              ├── (删除)
  ├── **important**                   ├── important (去粗体)
  ├── * bullet item                   ├── bullet item (去子弹符)
  └── 多余空行                          └── 压缩到1行

节省: ~36% token
```

---

## 三个核心功能

### 1. 类型安全的引用

不用手写路径，用生成的 `skill()` 函数：

```ts
import { skill } from "../.skill/skill";

const review = skill("/review");              // IDE 自动补全路径
const rules  = skill("/review/rules.md");     // 写错路径会报类型错误
```

Hover 任意 `skill()` 调用，IDE 直接显示：

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
```

零插件，全靠 TypeScript Language Service。

### 2. 编译优化

8 个编译插件，按需开关：

| 插件 | 做什么 | 配置项 |
|------|--------|--------|
| 去注释 | `<!-- -->` 清除 | `comment: true` |
| 去格式 | `**加粗**` `*斜体*` `~~删除~~` | `formatting: true` |
| 去图片 | `![](url)` 清除 | `image: true` |
| 去引用 | `> 引用` → `引用` | `blockquote: true` |
| 去分割线 | `---` 清除 | `thematicBreak: true` |
| 去子弹符 | `* - +` 列表标记 | `bullet: true` |
| 去空行 | 多余空行压缩 | `whitespace: true` |

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

自动完成：
- 创建 `skills/SKILL.md`
- 生成 `skill.config.js`（可选配置清除规则）
- 设置 `package.json` 的 `"type": "module"`
- 添加 `npm run skill:build` 和 `npm run skill:dev` 脚本

### 写 Skill

```markdown
# Code Review

<!-- TODO: 后续加入安全检查 -->

## State Management
- 避免派生状态
- 状态就近存放
```

### 编译 + 使用

```bash
npm run skill:build
```

```ts
import { skill } from "../.skill/skill";

const rules = skill("/review/rules.md");

// 读取编译后的 Markdown，塞进 LLM
const content = await rules.read();
```

### 接入任意框架

```ts
// LangChain
const rules = skill("/review/rules.md");
const llm = new ChatOpenAI({ model: "gpt-4o" });
await llm.invoke([
  { role: "system", content: await rules.read() },
]);

// Mastra
const agent = new Agent({
  instructions: await rules.read(),
  model: "openai/gpt-4o",
});
```

编译产物是标准 Markdown，不需要任何 adapter。

---

## 配置

`skill.config.js`：

```js
import { defineConfig } from "review-skill";

export default defineConfig({
  skillsDir: "skills",
  outputDir: ".skill",
  strip: {
    comment: true,        // <!-- HTML 注释 -->
    formatting: true,     // **粗体** *斜体* ~~删除线~~
    image: true,          // ![图片](url)
    blockquote: true,     // > 引用
    thematicBreak: true,  // --- 分割线
    bullet: true,         // * - + 列表符
    whitespace: true,     // 多余空行
  },
});
```

想保留某个格式，把对应项设为 `false` 就行。

---

## 架构

```
skills/                     ← 你写的（有注释、有空行）
    │
    │  review-skill build
    ▼
.skill/
├── runtime/                ← LLM 读的（去噪、压缩）
├── metadata.json           ← 统计数据
└── skill.ts                ← IDE 类型（自动补全 + Hover）
```

整个工具是一个 npm 包，编译后的 JS 只有 14KB。依赖 `unified` + `remark` 做 Markdown AST 操作，`esbuild` 打包发布。

---

## 链接

- GitHub: [qiao-coding/review-skill](https://github.com/qiao-coding/review-skill)
- npm: [review-skill](https://www.npmjs.com/package/review-skill)

---

*觉得有用的话欢迎 Star ⭐️，有问题提 Issue。*
