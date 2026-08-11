# review-skill

Compile Markdown Agent Skills into type-safe, token-aware runtime artifacts.

![review-skill overview](assets/review-skill-overview.png)

Language: English | [简体中文](README.zh-CN.md)

## Navigation

- [Features](#features)
- [Quick start](#quick-start)
- [Agent framework integrations](#agent-framework-integrations)
- [Configuration](#configuration)

`review-skill` helps developers manage agent instructions like application assets. Write reusable skills in Markdown, compile them once, and consume them from TypeScript through the generated `@review-skill/skill` path alias.

### Where it fits

```
You write Markdown            review-skill compiles          Your agent reads
skills/                        ↓                             .skill/runtime/
  SKILL.md          →          token-optimized runtime       system prompt
  review/rules.md   →          typed imports                 review.content
```

Other tools inject into AGENTS.md or generate standalone agents. **review-skill is for TypeScript developers who want their skills tracked like code dependencies** — autocomplete, hover info, type-checking, and token stats, all through the compiler's generated type declarations. No IDE plugin needed.

## Features

### 1. Write skills as Markdown

Keep agent behavior in a clear `skills/` directory. Human-readable Markdown stays in source control; generated runtime files stay in `.skill/`.

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

### 2. Autocomplete every skill path

After compilation, `skill("/")` and every nested skill/resource path are available to your editor. You no longer need to hand-write fragile relative `readFile(...)` paths.

![skill path autocomplete](assets/router-tip.png)

```ts
import { skill } from "@review-skill/skill";

const root = skill("/");
const rules = skill("/react/rules/state.md");
```

### 3. Inspect metadata in TypeScript hover tooltips

Place the cursor over a generated `skill()` call in a TypeScript-aware editor to see the skill title, description, source file, current character/token count, estimated compiled runtime size, and percentage saved.

![skill TypeScript hover tooltip with metadata and token stats](assets/hover-tip.png)

### 4. Ship optimized prompt content

`review-skill` removes prompt noise outside code blocks, including comments, formatting markers, image syntax, extra blank lines, and trailing whitespace. Code examples stay intact.

During development, keep your skill files readable with comments, formatting, tables, and internal notes:

![source skill before compilation](assets/dev-skill.png)

After compilation, the runtime Markdown is cleaner and cheaper to send to the model:

![compiled skill after optimization](assets/build-skill.png)

### 5. Use the output in any agent stack

Compiled resources are plain Markdown strings, so they can be used as system prompts, developer instructions, tool rules, review policies, or RAG chunks.

## Quick start

### 1. Install

```bash
npm install review-skill
```

### 2. Initialize

```bash
npx review-skill --init
```

This creates `skills/SKILL.md`, adds `.skill/` to `.gitignore`, generates `skill.config.js` or `skill.config.mjs`, configures the `@review-skill/skill` TypeScript path alias, and adds useful npm scripts when possible.

### 3. Write a skill

```markdown
# React Code Review

You are an expert React reviewer. Focus on correctness, state management,
effects, rendering performance, and security-sensitive patterns.

See `skill("/react/rules/state.md")` for state rules.
See `skill("/react/rules/effects.md")` for effect rules.
```

### 4. Compile

```bash
npx review-skill
```

Or use the generated scripts:

```bash
npm run skill:build
npm run skill:dev
```

Example output:

```text
Compiled 6 files in 91ms
  3 skills | Source 2145 -> Runtime 1751 tokens | -18.4%
```

### 5. Use the generated runtime

```ts
import { skill } from "@review-skill/skill";

const rules = skill("/react/rules/state.md");

console.log(rules.meta.title);
console.log(rules.meta.runtime.tokens);

const markdown = rules.content;
```

## Agent framework integrations

### LangChain

Use a compiled skill resource as the system message.

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

### Mastra

Use compiled Markdown as agent instructions.

```ts
import { Agent } from "@mastra/core";
import { skill } from "@review-skill/skill";

const review = skill("/react");
const rules = skill("/react/rules/state.md");

const agent = new Agent({
  name: review.meta.title,
  instructions: rules.content,
  model: "openai/gpt-4o",
});
```

### Vercel AI SDK

Pass compiled Markdown into `system`.

```ts
import { generateText } from "ai";
import { skill } from "@review-skill/skill";

const rules = skill("/react/rules/state.md");

const { text } = await generateText({
  model: "openai/gpt-4o",
  system: rules.content,
  prompt: `Review this code:\n${code}`,
});
```

### OpenAI SDK

Use compiled Markdown as the developer instruction.

```ts
import OpenAI from "openai";
import { skill } from "@review-skill/skill";

const rules = skill("/react/rules/state.md");
const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-4.1",
  input: [
    { role: "developer", content: rules.content },
    { role: "user", content: `Review this code:\n${code}` },
  ],
});
```

### Custom agent

Read a compiled resource and pass the Markdown string to your own prompt builder.

```ts
import { skill } from "@review-skill/skill";

const guide = skill("/security/owasp.md");

agent.setSystemPrompt(guide.content);
```

## Configuration

`skill.config.js` controls what gets stripped during compilation:

```js
import { defineConfig } from "review-skill";

export default defineConfig({
  skillsDir: "skills",
  outputDir: ".skill",
  strip: {
    comment: true,        // <!-- HTML comments -->
    formatting: true,     // **bold** *italic* ~~strike~~
    image: true,          // ![alt](url)
    blockquote: true,     // > quotes
    thematicBreak: true,  // --- horizontal rules
    bullet: true,         // * - + list markers
    whitespace: true,     // blank lines, trailing spaces
  },
});
```

Set any option to `false` to keep that element in the runtime output.

## Links

- [GitHub](https://github.com/qiao-coding/review-skill)
- [npm](https://www.npmjs.com/package/review-skill)

## License

MIT
