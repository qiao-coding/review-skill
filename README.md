# review-skill

A TypeScript-first skill framework for Markdown Agent Skills — author skills in Markdown, compile once, consume them as typed imports. Type-safe references, token-aware runtime, zero IDE plugins.

![review-skill overview](assets/review-skill-overview.png)

Language: English | [简体中文](README.zh-CN.md)

---

- [Overview](#overview)
- [Quick start](#quick-start)
- [Authoring skills](#authoring-skills)
- [Compiling & configuration](#compiling--configuration)
- [Consuming skills](#consuming-skills)
- [Integrations](#integrations)
- [Links & license](#links--license)

---

## Overview

`review-skill` helps developers manage agent instructions like application assets: write reusable skills in Markdown, compile them once, and consume them from TypeScript through typed imports. Autocomplete, hover metadata, token stats, and build-time reference checking all come from the compiler — no IDE plugin.

```
You write Markdown            review-skill compiles          Your agent reads
skills/                        ↓                             .skill/runtime/
  SKILL.md          →          token-optimized runtime       system prompt
  review/rules.md   →          typed imports                 review.content
```

### Framework layers

One source of truth (`.skill/`) feeds three layers:

| Layer | Command / package | What you get |
|---|---|---|
| **Compiler** | `npx review-skill` | `skills/*.md` → token-optimized `.skill/` runtime; link references validated at build time; `--init` bootstraps a project with zero manual config |
| **Runtime** | `@review-skill/skill` | Typed `skill("/path")` imports, hover metadata, token stats, `bundle()` for a single self-contained context, typed `inject()` templates |
| **Integration** | `@review-skill/vite` | Skills as first-class `@skill/*` virtual modules; the plugin compiles on demand |

Other tools inject into AGENTS.md or generate standalone agents. review-skill is for TypeScript developers who want their skills tracked like code dependencies — the editor experience is native markdown links, at every layer.

## Quick start

### 1. Bootstrap — no manual config

```bash
npx review-skill --init
npm install
```

`--init` scaffolds `skills/`, a config file, the `@review-skill/skill` TypeScript path alias, npm scripts, and adds `review-skill` to your dependencies.

### 2. Write a skill

Skills can reference other skills with plain links and interpolate variables:

```markdown
---
variables:
  - name: focus
---
# React Code Review

You are an expert React reviewer. Focus on {{focus}}.

See [state rules](../react/rules/state.md) for state management.
```

### 3. Compile

```bash
npx review-skill
```

```text
Compiled 6 files in 91ms
  3 skills | Source 2145 -> Runtime 1751 tokens | -18.4%
```

### 4. Consume

```ts
import { skill, inject } from "@review-skill/skill";

const rules = skill("/react/rules/state.md");
const review = inject(rules.content, { focus: "state management" });
```

## Authoring skills

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

Source Markdown stays readable — comments, formatting, tables, internal notes. Compilation strips the noise (see [Compiling & configuration](#compiling--configuration)) so the runtime is leaner.

### References — native markdown links

Reference other skills with **plain markdown links**, resolved relative to the containing file:

```markdown
Follow the security constraints in [security](../security/SKILL.md) before drafting.
```

VS Code handles the editor side natively — path completion as you type, Ctrl+click jump (including code files), Ctrl+hover preview, rendered links in the preview. No extension, no settings, no plugin.

The compiler treats links as its reference contract:

- **Build-time validation** — a link whose target doesn't resolve to a known skill/resource is reported as a warning (`Unknown skill reference /path`).
- **`bundle()`** — recursively inlines the linked content into a single self-contained context (`[text](../path)` … `[/path]` sections; cycles guarded by `[cycle path]` markers).
- External URLs (`https://`), anchors, `mailto:`, and images (`![alt](url)`) are never treated as references.

> Note: reference-link syntax (`[x][id]` + `[id]: url`) is not yet scanned — use the inline `[x](../path)` form.

### Templates — {{variables}} + inject()

Skills can be templates. Declare a `variables` contract in frontmatter, use `{{placeholders}}` in prose:

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
- The compiler enforces the contract at build time: an undeclared `{{var}}` → **error**, a required variable never used → error, an optional one never used → warning, a malformed placeholder (`{{a-b}}`) → error, any `{{var}}` without a contract → error.
- Consume with typed `inject()` (see [Consuming skills](#consuming-skills)) — the compiler generates a per-skill interface so missing required keys fail at compile time.

## Compiling & configuration

### CLI

```bash
npx review-skill            # compile once
npx review-skill --watch    # rebuild on change
npx review-skill --init     # scaffold a new project
```

Compiling needs no config file — defaults are `skills/` → `.skill/`. The output:

| File | Contents |
|---|---|
| `.skill/runtime/**` | Compiled Markdown per skill/resource |
| `.skill/metadata.json` | Titles, descriptions, token stats, variable contracts |
| `.skill/skill.ts` | Typed `skill()` declarations + per-skill variable interfaces |

### strip — token optimization

Source files carry two audiences: **tooling metadata** (frontmatter, comments, formatting) and the **instructions** the agent should read. Compilation always drops the frontmatter block (variable contracts, titles, descriptions), and `strip` removes the rest of the tooling layer — the runtime is instructions only, never the surrounding explanation.

`---` is contextual: at the very top of a file it delimits the frontmatter block (always dropped); mid-document it's a horizontal rule (the `"---"` strip token).

`skill.config.js` / `skill.config.mjs` controls what compilation strips. `strip` is a **character-based token array**: list the exact markdown syntax literals to remove (each TS-autocompleted); omit anything you want kept. **Not configuring `strip` at all strips nothing — the original file is returned as-is**:

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

Available tokens (see `STRIP_TOKENS`): `"<!-- HTML -->"` HTML comments · `"**bold**"` bold · `"*italic*"` italic · `"~~strikethrough~~"` strikethrough · `"![alt](url)"` images · `"> quote"` blockquotes · `"---"` horizontal rules · `"- item"` bullet markers · `"\n\n"` blank-line collapse. An empty array `strip: []` strips nothing.

The legacy object form (`strip: { formatting: false }`) still works but is deprecated — the compiler warns with the exact equivalent token array. Migration guide: [docs/strip.md](docs/strip.md).

## Consuming skills

### skill() — typed imports

![skill path autocomplete](assets/router-tip.png)

After compilation, every skill/resource path is available with autocomplete — no hand-written relative paths:

```ts
import { skill } from "@review-skill/skill";

const root = skill("/");
const rules = skill("/react/rules/state.md");

console.log(rules.meta.title);           // "React State Rules"
console.log(rules.meta.runtime.tokens);  // runtime token count
const markdown = rules.content;
```

### Hover metadata

![skill TypeScript hover tooltip with metadata and token stats](assets/hover-tip.png)

Hover a `skill()` call to see the skill's title, description, source file, current character/token count, estimated compiled size, and percentage saved.

### bundle() — one self-contained context

```ts
const review = skill("/react");
const context = review.bundle(); // markdown links inlined recursively
```

### inject() — typed templates

For a skill with a `variables` contract, the compiler generates a per-skill interface (`/galgame/section-plan` → `GalgameSectionplanVars`) in `.skill/skill.ts`. Missing required keys fail at compile time:

```ts
import { skill, inject, type GalgameSectionplanVars } from "@review-skill/skill";

const scene = inject<GalgameSectionplanVars>(skill("/galgame/section-plan").content, {
  sceneTitle: "Act 2",
  // isFinale is optional — omit it
});
// omitting sceneTitle → TS error: property 'sceneTitle' is missing
```

## Integrations

### Agent frameworks

Compiled resources are plain Markdown strings, so they work in any prompt builder — as system prompts, developer instructions, tool rules, review policies, or RAG chunks.

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

#### Custom agent

```ts
import { skill } from "@review-skill/skill";

const guide = skill("/security/owasp.md");
agent.setSystemPrompt(guide.content);
```

### @review-skill/vite

Skills become first-class modules: `@skill/meta` and `@skill/<path>`, auto-compiled by the plugin.

```ts
// vite.config.ts
import { skillFramework } from "@review-skill/vite";
export default defineConfig({ plugins: [skillFramework()] });
```

```ts
import plan from "@skill/galgame/section-plan"; // compiled runtime, links inlined
import meta from "@skill/meta";                 // metadata.json as SkillMeta[]
```

The plugin recompiles when the metadata is missing or older than any source file, and exposes `@skill/*` module types via `@review-skill/vite/client`.

## Links & license

- [GitHub](https://github.com/qiao-coding/review-skill)
- [npm](https://www.npmjs.com/package/review-skill)
- [@review-skill/vite on npm](https://www.npmjs.com/package/@review-skill/vite)

MIT
