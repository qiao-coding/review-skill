# review-skill

A TypeScript-first skill framework for Markdown Agent Skills — author skills in Markdown, compile once, consume them as typed imports. Type-safe references, token-aware runtime, zero IDE plugins.

![review-skill overview](assets/review-skill-overview.png)

Language: English | [简体中文](README.zh-CN.md)

## Navigation

- [Framework](#framework)
- [Features](#features)
- [Quick start](#quick-start)
- [Agent framework integrations](#agent-framework-integrations)
- [Configuration](#configuration)
- [Templates and inject()](#templates-and-inject)

`review-skill` helps developers manage agent instructions like application assets. Write reusable skills in Markdown, compile them once, and consume them from TypeScript through the generated `@review-skill/skill` path alias.

### Where it fits

```
You write Markdown            review-skill compiles          Your agent reads
skills/                        ↓                             .skill/runtime/
  SKILL.md          →          token-optimized runtime       system prompt
  review/rules.md   →          typed imports                 review.content
```

Other tools inject into AGENTS.md or generate standalone agents. **review-skill is a skill framework for TypeScript developers who want their skills tracked like code dependencies** — autocomplete, hover info, type-checking, and token stats, all through the compiler's generated type declarations. No IDE plugin needed.

## Framework

review-skill is a **framework**, not just a compiler. Three layers work on one source of truth (`.skill/`):

| Layer | What you get |
|---|---|
| **Compiler** — `npx review-skill` | `skills/*.md` → token-optimized `.skill/` runtime; link references validated at build time; `--init` bootstraps a project with zero manual config |
| **Runtime** — `@review-skill/skill` | Typed `skill("/path")` imports with autocomplete, hover metadata, token stats, and `bundle()` for a single self-contained context |
| **Integration** — `@review-skill/vite` | Skills as first-class `@skill/*` virtual modules — import a skill like any other module; the plugin compiles on demand |

The editor experience is native markdown links — no IDE plugin at any layer.

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

### 1. Bootstrap — no manual configuration

```bash
npx review-skill --init
npm install
```

`--init` creates `skills/SKILL.md`, adds `.skill/` to `.gitignore`, generates `skill.config.js` or `skill.config.mjs`, configures the `@review-skill/skill` TypeScript path alias, adds useful npm scripts, and adds `review-skill` to your `dependencies` — `npm install` then installs it. Compiling needs no config file at all (defaults: `skills/` → `.skill/`).

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

`skill.config.js` controls what gets stripped during compilation — `strip` is a
**character-based token array**: list the exact markdown syntax literals to strip
(each is TS-autocompleted), omit anything you want kept. **Not configuring
`strip` at all strips nothing — the original file is returned as-is**:

```js
import { defineConfig } from "review-skill";

export default defineConfig({
  skillsDir: "skills",
  outputDir: ".skill",
  // delete entries you want KEPT; omit strip entirely to return the original:
  strip: [
    "<!-- HTML -->", // HTML comments
    "**bold**",       // bold
    "*italic*",       // italic
    "~~strikethrough~~",
    "![alt](url)",    // images
    "> quote",        // blockquotes
    "---",            // horizontal rules
    "- item",         // bullet markers
    "\n\n",           // blank-line collapse
  ],
});
```

Available tokens (see `STRIP_TOKENS`): `"<!-- HTML -->"` HTML comments ·
`"**bold**"` bold · `"*italic*"` italic · `"~~strikethrough~~"` strikethrough ·
`"![alt](url)"` images · `"> quote"` blockquotes · `"---"` horizontal rules ·
`"- item"` bullet markers · `"\n\n"` blank-line collapse.
An empty array `strip: []` strips nothing.

The legacy object form (`strip: { formatting: false }`) still works but is
deprecated — the compiler warns with the exact equivalent token array. Migration
guide: [docs/strip.md](docs/strip.md).

## References use native markdown links

Skill prose references other skills with **plain markdown links** — no custom syntax needed:

```markdown
Follow the security constraints in [security](../security/SKILL.md) before drafting.
See [state rules](../react/rules/state.md) for state management.
```

Links resolve **relative to the containing file** in the `skills/` layout, and VS Code handles the editor side natively — path completion as you type, Ctrl+click to jump (including code files), Ctrl+hover to preview, and rendered links in the markdown preview. No extension, no settings, no plugin.

The compiler treats these links as its reference contract:

- **Compile-time validation** — a link whose target doesn't resolve to a known skill/resource is reported as a warning (`Unknown skill reference /path`).
- **`bundle()`** — recursively inlines the linked content into a single self-contained context (`[text](../path)` … `[/path]` sections), with cycles guarded by `[cycle path]` markers.
- External URLs (`https://`), anchors, `mailto:`, and images (`![alt](url)`) are never treated as references.

Note: reference-link syntax (`[x][id]` + `[id]: url`) is not yet scanned — use the inline `[x](../path)` form.

## Templates and inject()

Skills can be templates. Declare a `variables` contract in the YAML frontmatter, use `{{placeholders}}` in prose, and fill them in at consumption time with typed `inject()`.

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

- `required` defaults to `true`; set `required: false` for optional variables.
- The compiler enforces the contract at build time: an undeclared `{{var}}` → **error**, a required variable never used → error, an optional one never used → warning, a malformed placeholder (`{{a-b}}`) → error. Using any `{{var}}` without a frontmatter contract → error.

Consume the compiled template:

```ts
import { skill, inject } from "@review-skill/skill";

const template = skill("/galgame/section-plan").content;
const scene = inject(template, { sceneTitle: "Act 2", isFinale: "yes" });
// missing keys are replaced with "" — the "no such block" convention
```

When a skill declares `variables`, the compiler generates a per-skill interface (`/galgame/section-plan` → `GalgameSectionplanVars`) in `.skill/skill.ts`, so missing required keys fail at compile time:

```ts
import { skill, inject, type GalgameSectionplanVars } from "@review-skill/skill";

const scene = inject<GalgameSectionplanVars>(template, {
  sceneTitle: "Act 2",
  // isFinale is optional — omit it
});
// omitting sceneTitle → TS error: property 'sceneTitle' is missing
```

## Links

- [GitHub](https://github.com/qiao-coding/review-skill)
- [npm](https://www.npmjs.com/package/review-skill)

## License

MIT
