# review

把 Markdown 编写的 Agent Skill 编译成类型安全、可统计 token、可直接运行的产物。

![review 项目概览](assets/review-overview.png)

语言：[English](README.md) | 简体中文

## 导航

- [功能介绍](#功能介绍)
- [快速开始](#快速开始)
- [不同 Agent 框架如何接入](#不同-agent-框架如何接入)

`review` 帮开发者把 Agent 指令当成真正的工程资产来管理。你可以用 Markdown 编写可复用 Skill，把它们编译成更适合运行时使用的文件，然后通过生成的 TypeScript API 在 Agent 应用里安全引用。

## 功能介绍

### 用 Markdown 编写 Skill

用普通 Markdown 维护 Agent 行为，把指令放进代码仓库，并像审查代码一样审查它。

```text
skills/
|-- SKILL.md
`-- review/
    |-- SKILL.md
    `-- rules.md
```

### 类型安全地引用 Skill

用生成的 `skill()` 引用替代脆弱的相对文件路径。

```ts
const review = skill("/review");
const rules = skill("/review/rules.md");
```

### 生成更省 token 的运行时内容

编译阶段会清理代码块外的 prompt 噪声，包括注释、装饰性格式、图片语法、多余空行和行尾空白。

### 适配任意 Agent 框架

编译结果是标准 Markdown，可以接入 LangChain、Mastra、Vercel AI SDK、OpenAI SDK，或你自己的 Agent 运行时。

### 适合开发流程

支持初始化 Skill 目录、单次编译，以及本地开发时监听文件变化。

```bash
npx review --init
npx review
npx review --watch
```

## 快速开始

### 1. 安装

```bash
npm install review
```

### 2. 初始化 Skill

```bash
npx review --init
```

它会创建初始的 `skills/SKILL.md`，并把 `.skill/` 加入 `.gitignore`。

### 3. 编写 Skill

```markdown
# Code Review

<!-- 内部备注：后续补充安全检查。 -->

## State Management

- Avoid derived state when it can be calculated during render.
- Keep state close to the component or workflow that owns it.

See `skill("/review/rules.md")` for detailed review rules.
```

### 4. 编译

```bash
npx review
```

示例输出：

```text
Compiled 3 files in 45ms
  2 skills | Source 1456 -> Runtime 1194 tokens | -18.0%
```

### 5. 使用生成的运行时

```ts
import { skill } from "../.skill/skill";

const rules = skill("/review/rules.md");

const markdown = await rules.read();
```

## 不同 Agent 框架如何接入

### LangChain

把编译后的 Skill 资源作为 system message。

```ts
import { ChatOpenAI } from "@langchain/openai";
import { skill } from "../.skill/skill";

const rules = skill("/review/rules.md");

const llm = new ChatOpenAI({ model: "gpt-4o" });

const result = await llm.invoke([
  { role: "system", content: await rules.read() },
  { role: "user", content: `Review this code:\n\`\`\`ts\n${userCode}\n\`\`\`` },
]);
```

### Mastra

把编译后的 Markdown 作为 Agent instructions。

```ts
import { Agent } from "@mastra/core";
import { skill } from "../.skill/skill";

const review = skill("/review");
const rules = skill("/review/rules.md");


const agent = new Agent({
  name: review.meta.title,
  instructions: await rules.read(),
  model: "openai/gpt-4o",
});
```

### Vercel AI SDK

把编译后的 Markdown 传给 `system`。

```ts
import { generateText } from "ai";
import { skill } from "../.skill/skill";

const rules = skill("/review/rules.md");

const { text } = await generateText({
  model: "openai/gpt-4o",
  system: await rules.read(),
  prompt: `Review this code:\n${code}`,
});
```

### OpenAI SDK

把编译后的 Markdown 作为 developer instruction。

```ts
import OpenAI from "openai";
import { skill } from "../.skill/skill";

const rules = skill("/review/rules.md");

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-4.1",
  input: [
    { role: "developer", content: await rules.read() },
    { role: "user", content: `Review this code:\n${code}` },
  ],
});
```

### 自定义 Agent

读取编译后的资源文件，再交给你自己的 prompt builder。

```ts
import { skill } from "../.skill/skill";

const guide = skill("/my-skill/guide.md");

agent.setSystemPrompt(await guide.read());
```

## License

MIT
