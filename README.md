# review

Turn Markdown Agent Skills into type-safe, token-aware runtime artifacts.

![review overview](assets/review-overview.png)

Language: English | [简体中文](README.zh-CN.md)

## Navigation

- [Features](#features)
- [Quick start](#quick-start)
- [Agent framework integrations](#agent-framework-integrations)

`review` helps developers manage agent instructions like application
assets. You write reusable skills in Markdown, compile them into optimized
runtime files, and consume them through a generated TypeScript API.

## Features

### Markdown-first skill authoring

Write agent behavior in plain Markdown, keep it in your repository, and review
it like code.

```text
skills/
|-- SKILL.md
`-- review/
    |-- SKILL.md
    `-- rules.md
```

### Type-safe skill references

Use generated `skill()` references instead of fragile relative file paths.

```ts
const review = skill("/review");
const rules = skill("/review/rules.md");
```

### Token-aware runtime content

Build-time optimization removes prompt noise outside code blocks, including
comments, decorative formatting, image syntax, extra blank lines, and trailing
whitespace.

### Framework-independent output

Compiled skills are plain Markdown, so you can pass them into LangChain, Mastra,
the Vercel AI SDK, the OpenAI SDK, or your own agent runtime.

### Developer workflow

Initialize a skill directory, compile skills once, or watch files during local
development.

```bash
npx review-skill --init
npx review-skill
npx review-skill --watch
```

## Quick start

### 1. Install

```bash
npm install review
```

### 2. Initialize skills

```bash
npx review-skill --init
```

This creates an initial `skills/SKILL.md` and adds `.skill/` to `.gitignore`.

### 3. Write a skill

```markdown
# Code Review

<!-- Internal note: expand security checks later. -->

## State Management

- Avoid derived state when it can be calculated during render.
- Keep state close to the component or workflow that owns it.

See `skill("/review/rules.md")` for detailed review rules.
```

### 4. Compile

```bash
npx review-skill
```

Example output:

```text
Compiled 3 files in 45ms
  2 skills | Source 1456 -> Runtime 1194 tokens | -18.0%
```

### 5. Use the generated runtime

```ts
import { skill } from "../.skill/skill";

const rules = skill("/review/rules.md");

const markdown = await rules.read();
```

## Agent framework integrations

### LangChain

Use a compiled skill resource as the system message.

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

Use compiled Markdown as agent instructions.

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

Pass compiled Markdown into `system`.

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

Use compiled Markdown as the developer instruction.

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

### Custom agent

Read a compiled resource and pass the string to your own prompt builder.

```ts
import { skill } from "../.skill/skill";

const guide = skill("/my-skill/guide.md");

agent.setSystemPrompt(await guide.read());
```

## License

MIT
