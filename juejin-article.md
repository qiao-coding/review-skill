# review-skill：把 Agent Skill 变成可补全、可 hover、可统计 token 的工程资产

如果你在做 AI Agent 项目，大概率会把 prompt、规则、工具说明放进 Markdown：

```text
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

这种方式很自然，因为 Markdown 好写、好审、好放进仓库。但项目变大后，它会暴露几个问题：

1. 路径容易漂移：手写 `readFile("../../../skills/react/rules/state.md")`，文件移动后很难第一时间发现。
2. token 成本不可见：一个 Skill 到底会塞多少上下文给模型，通常没有直观数据。
3. prompt 内容偏重：注释、格式标记、空行、图片语法可能都被带进运行时。
4. IDE 没有参与感：Markdown 在一边，TypeScript 调用点在另一边，很难获得补全和 hover 信息。

`review-skill` 解决的就是这件事：把 Markdown Skill 编译成类型安全、可统计 token、可直接读取的运行时产物。

![review-skill 项目概览](assets/review-skill-overview.png)

## 功能一：Skill 路径自动补全

初始化并编译后，你可以通过 `@review-skill/skill` 引用所有 Skill：

```ts
import { skill } from "@review-skill/skill";

const root = skill("/");
const rules = skill("/react/rules/state.md");
```

当你输入 `skill("/")` 时，编辑器会自动列出当前项目中所有可用路径。

![Skill 路径自动补全](assets/router-tip.png)

这意味着你不再需要手写深层相对路径，也不需要等到运行时才发现文件引用错了。

## 功能二：Hover 查看 Skill 信息

`review-skill` 不只是生成一个读取函数，还会把 Skill 的元信息写进类型提示里。

把鼠标放到 `skill("/")` 上，可以看到标题、描述、源文件位置、文件数量、字符数和 token 估算。

![Skill hover 摘要](assets/hover-tip-a.png)

继续看 hover 信息，还能看到编译后的运行时 token 预算，比如常用、P95 和最大值。

![Skill hover token 统计](assets/hover-tip-b.png)

这让 prompt 成本变得像 bundle size 一样可见。你不需要猜一个 Skill 有多重，编辑器直接告诉你。

## 功能三：编译出更轻的运行时 Markdown

开发时的 Markdown 应该适合人读，所以它可以有注释、格式、空行和说明。但运行时给模型的内容应该尽量干净。

`review-skill` 会在代码块外清理这些内容：

| 内容 | 处理方式 |
| --- | --- |
| `<!-- HTML comments -->` | 删除 |
| `**bold**`、`*italic*`、`~~strike~~` | 保留文字，去掉格式标记 |
| `![image](url)` | 删除 |
| `> quote` | 去掉引用标记 |
| `---`、`***` | 删除 |
| `*`、`-`、`+` 列表标记 | 清理 |
| 多余空行、行尾空白 | 压缩 |

代码块会被保护，示例代码不会被改写。

## 快速开始

安装：

```bash
npm install review-skill
```

初始化：

```bash
npx review-skill --init
```

这一步会自动做几件事：

- 创建 `skills/SKILL.md`
- 生成 `skill.config.js` 或 `skill.config.mjs`
- 把 `.skill/` 加入 `.gitignore`
- 配置 TypeScript 路径别名 `@review-skill/skill`
- 尽可能添加 `npm run skill:build` 和 `npm run skill:dev`

编译：

```bash
npx review-skill
```

或者：

```bash
npm run skill:build
npm run skill:dev
```

使用：

```ts
import { skill } from "@review-skill/skill";

const rules = skill("/react/rules/state.md");

console.log(rules.meta.title);
console.log(rules.meta.runtime.tokens);

const markdown = await rules.read();
```

## 接入不同 Agent 框架

`review-skill` 的运行时输出就是 Markdown 字符串，所以不需要专用 adapter。

### LangChain

```ts
import { ChatOpenAI } from "@langchain/openai";
import { skill } from "@review-skill/skill";

const rules = skill("/react/rules/state.md");
const llm = new ChatOpenAI({ model: "gpt-4o" });

await llm.invoke([
  { role: "system", content: await rules.read() },
  { role: "user", content: "Review this React component." },
]);
```

### Mastra

```ts
import { Agent } from "@mastra/core";
import { skill } from "@review-skill/skill";

const review = skill("/react");
const rules = skill("/react/rules/state.md");

const agent = new Agent({
  name: review.meta.title,
  instructions: await rules.read(),
  model: "openai/gpt-4o",
});
```

### Vercel AI SDK

```ts
import { generateText } from "ai";
import { skill } from "@review-skill/skill";

const rules = skill("/react/rules/state.md");

const { text } = await generateText({
  model: "openai/gpt-4o",
  system: await rules.read(),
  prompt: "Review this component.",
});
```

### OpenAI SDK

```ts
import OpenAI from "openai";
import { skill } from "@review-skill/skill";

const rules = skill("/react/rules/state.md");
const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-4.1",
  input: [
    { role: "developer", content: await rules.read() },
    { role: "user", content: "Review this component." },
  ],
});
```

## 总结

`review-skill` 的目标很简单：让 Agent Skill 像代码一样可维护。

它不会限制你怎么写 Agent，也不会绑定某个框架。它只负责把 Markdown Skill 变成更适合工程使用的形态：

- 路径可补全
- 信息可 hover
- token 可估算
- 运行时 Markdown 更轻
- 任意 Agent 框架都能接入

链接：

- GitHub: [qiao-coding/review-skill](https://github.com/qiao-coding/review-skill)
- npm: [review-skill](https://www.npmjs.com/package/review-skill)
