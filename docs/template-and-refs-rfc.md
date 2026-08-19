# RFC: 模板变量与片段引用（Template Variables & Fragment Refs）

> 状态：Draft · 作者：协议零号作者本人 · 范围：review-skill 0.3.0 前设计评审
> 触发场景：Protocol Zero 章节规划 prompt 是 25 变量大模板，review-skill 无法组织。

---

## 1. 背景

review-skill 目前的定位是「Markdown skill 编译器」：`skills/` → strip → `.skill/runtime`，TS 消费侧用 `skill(path).content` 拿编译产物。它解决了两件事：strip 减 token、TS 侧类型化路径（typed references）。

但它**假设每个 skill 是静态文本**。一旦出现这种模板，假设就破了：

```md
【本节位置】本章第 {{sectionIndex}}/{{totalSections}} 节（本章共 {{totalSections}} 节；最后一节=归家就寝+睡前内心戏）
{{isFinaleHint}}

{{prevHandoffCtx}}
{{prevSceneCtx}}
【亲密度】当前={{intimacy}}（{{intimacyDesc}}）{{zeroState}}
【本章目标亲密度】={{targetIntimacy}}（{{targetIntimacyDesc}}）——本章结束时关系要推进到这级，本节对白按「从当前往目标推进」来写，禁止一整章停在当前级不推进。
【肢体接触（按当前亲密度）】{{intimacyPhysical}}
【主角-Zero绑定】{{protagonistZeroBinding}}
【共同目标】{{sharedGoal}}
【本节同场状态】{{coPresenceState}}；理由={{coPresenceReason}}
【本节关系意图】{{relationshipIntent}}；恋爱配额={{romanceBeatQuota}}
【本节关系事件（行为化：谁对谁做了什么关系行为 + 在哪个场景物件/动作 + 留下什么铺垫）】{{relationshipEvent}}
本节: {{sectionTitle}} | 氛围={{sectionAtmosphere}} | 地点意图={{locationIntent}}
本节结束场景: {{endSceneId}}
【本节场景内容】{{currentScene}} — 对白/动作/旁白可提及此场景的真实陈设与物件，禁止凭空虚构场景中不存在的道具。
【本节方向 — 按这段自由写出整节对白】
{{direction}}
【已确立设定（保持一致，禁止改名/矛盾）】{{establishedFacts}}
```

这模板有 **25 个变量**、结构性标签行、条件性注入（`{{isFinaleHint}}`、`{{zeroState}}`）、跨章节状态引用（`{{prevHandoffCtx}}`、`{{establishedFacts}}`）。

## 2. 痛点清单

对这段模板逐条对号：

| # | 痛点 | 现状后果 | 对应模板证据 |
|---|------|---------|-------------|
| P1 | **变量无契约** | 改漏一个变量名，编译不报错，裸 `{{foo}}` 静默进 prompt | 25 个 `{{...}}` 零声明 |
| P2 | **条件逻辑靠「空/非空」纪律** | 传错一次就挂，无机制兜底 | `{{isFinaleHint}}`、`{{zeroState}}` |
| P3 | **结构性块无法跨文件复用** | 亲密度查表在多个 skill 复制粘贴，双倍维护 | 亲密度→描述/肢体接触/零状态是纯查表 |
| P4 | **引用无来源声明** | 模板看不出 `{{prevHandoffCtx}}` 从哪拿、指向什么 | `{{prevHandoffCtx}}`、`{{prevSceneCtx}}`、`{{establishedFacts}}` |
| P5 | **token 统计失真** | 编译 token≈静态值，注入后实际 +1500+，token-aware 卖点在动态场景失效 | `{{establishedFacts}}` 可注入上千 token |
| P6 | **一屏装不下，人没法 review** | review-skill 名字本身就是「给你 review 的 skill」 | 整段 25 变量平铺 |

其中 P1/P2 是**正确性问题**（静默失效），P3/P4 是**复用性问题**（双倍维护、来源不明），P5 是**度量失真**，P6 是**可读性**。

## 3. 现状（pipeline 关键位置）

编译主流程 `src/compiler/pipeline.ts:compile()`：

```
discover() → 每文件:
  read → sourceChars → estimateTokens(chars/4)
  parseMarkdown() → analyze() [title/description/headingTree]
  transformMarkdown(strip) → runtimeChars → estimateTokens
  emitRuntime()  [.skill/runtime/<path>.md]
最后 emitMetadata() [.skill/metadata.json] + emitTypesDts() [.skill/skill.ts]
```

关键事实：
- `analyze.ts` 只提取 `{title, description, headingTree}`，**不扫变量**。
- `transform.ts` 的 strip 不碰 `{{...}}`（非 code block 也会原样保留），所以变量现在只是「透明穿墙」。
- `SkillMeta`（`types.ts:10`）无 variables 字段。
- `SkillRef`（`types.ts:45`）只暴露 `meta` + `content`，无注入 API。
- `tokenize.ts`：`charCount / 4`，纯静态。
- 消费侧 `skill(path)`（`skill.ts:64`）读编译产物，调用方自己替换变量。
- i18n 在 `src/i18n.ts`，错误信息需双语（en / zh-CN）。

结论：**模板支持是 0**。全部靠调用方纪律。

## 4. 设计：三个渐进层次

原则：贴着现有 pipeline 加，禁止过度抽象（不做模板 DSL 引擎、不做自定义语法糖）。

### L1 变量契约（编译期校验 + metadata 输出）

**目标**：消灭 P1（静默失效）。编译期校验 + metadata 输出；消费侧 `inject()` 做纯 `{{name}}` 替换。

**契约声明**：文件 frontmatter（优先）∪ `skill.config.js` 全局（兜底）。

```md
---
variables:
  - name: intimacy
    required: true
    hint: "当前亲密度 0-7 级"
  - name: isFinaleHint
    required: false
---
```

**编译期行为**（新模块 `src/compiler/variables.ts`）：

1. 扫描 mdast 文本节点，收集 `{{([a-zA-Z_][a-zA-Z0-9_]*)}}` 清单。
2. 校验：扫描到的变量不在契约 → **error**（列出具体变量名与文件名）；契约 `required: true` 但模板未使用 → **error**；声明未用（required:false）→ **warn**。
3. metadata 输出每个 entry 的 `variables: VariableDecl[]`。

**Schema 扩展**（`types.ts`）：

```ts
interface VariableDecl {
  name: string;
  required: boolean;
  estimateTokens?: number;   // L3 用，L1 先留空
  hint?: string;
}

interface SkillMeta {
  // …现有字段
  variables?: VariableDecl[];
}
```

**消费侧 API**（`skill.ts` 新增，L1 只提供工具，不强约束类型）：

```ts
/** 纯变量替换：展开 {{name}}。未提供 required 变量 → throw。不做模板控制流。 */
export function inject(template: string, vars: Record<string, string>): string
```

**i18n**：校验错误经 `i18n.ts` 双语输出，CLI 退出码非 0。

**改动点**：新增 `variables.ts`；`analyze.ts` 或 pipeline 调它；`types.ts` 加字段；`emit/metadata.ts` 透传；`skill.ts` 加 `inject`；`i18n.ts` 加 2-3 条错误文案；`transform.test/pipeline.test` 加用例。

---

### L2 片段引用（Markdown 内跨文件 inline）

**目标**：消灭 P3（复用）、部分 P4（来源声明）。

**语法**：独占一行的段落 `@ref: <path>`；可选锚点 `@ref: <path>#<heading>`。

```md
## 亲密度
@ref: fragments/intimacy

## 肢体接触（按当前亲密度）
@ref: fragments/intimacy-physical
```

**目录约定**：`skills/_fragments/`（下划线前缀）下的文件**不单独产出** runtime/metadata，只作为引用源。`discover.ts` 需过滤 `_fragments/`（现有实现把一切 `.md` 当 resource 产出）。

**解析语义**（新 `src/compiler/refs.ts`，多遍解析）：

1. 每文件 transform 后，扫描段落级 `@ref:` 节点（段落只含一行 `@ref:` 文本才展开；混有别的文本 → warn）。
2. 引用目标解析：相对 `skills/` 的路径 → 该文件 transform 后的内容；带 `#anchor` → 取锚点小节子树（到下一个同级标题为止）。
3. **多遍**：被引用文件自己也含 `@ref:` → 递归展开（DFS + visiting set）。
4. 错误：目标缺失 → error；循环引用 → error 并列出链路（`a → b → a`）。
5. 产物是**扁平单文件**——`.skill/runtime/` 里看不到引用痕迹，和现在一致。

**关键取舍**：`@ref:` 是普通段落文本，天然躲过所有 strip 插件（formatting/blockquote/bullet 都不碰它），不需要新语法层。展开发生在 transform 之后、emit 之前，产物对下游（tokenize/emit）透明。

**token 统计**：片段展开发生在 `estimateTokens` 之前，所以 runtime tokens 天然包含展开后的内容——**顺带修复了片段场景的 P5**（片段被 inline 后按真实大小计）。

**改动点**：新增 `refs.ts`；`pipeline.ts` 在 `transformMarkdown` 后插入 resolve 阶段并重算 chars/tokens；`discover.ts` 过滤 `_fragments/`；`i18n.ts` 加缺失/循环错误。

---

### L3 注入后 token 估算

**目标**：补全 P5（token 失真）。

> **决策记录：模板不做控制流语法。** `{{#if}}` / `{{#unless}}` / `{{else}}` 全部砍掉。条件性注入（`{{isFinaleHint}}`、`{{zeroState}}`）用纯变量 + `required: false` 表达——调用方传空字符串即"无此段"，由调用方控制。理由：控制流语法是模板引擎式过度抽象，与「传变量」的简单模型冲突；L1 的 required 校验已提供兜底，P2 的剩余代价（调用方纪律）用户明确接受。

**注入后 token 估算**：

- `VariableDecl.estimateTokens`（L1 schema 已留位）声明典型注入长度。
- metadata 输出 `injectedTokens: number`（Σ estimateTokens，required 全算、可选按 max）。
- CLI 报告在 `runtime tokens` 旁追加一列 `+注入 ≈`。
- `runtime.tokens` 语义**不变**（它代表编译产物实际大小）；`injectedTokens` 是新增的「注入后」度量，两者并存避免破坏现有消费方。

**改动点**：`types.ts`/`metadata.ts` 加 `injectedTokens`；`cli.ts` 报告加一列；i18n 文案。

### L4 消费侧 hover 预览 + 快速引用对象索引（typed references 增强）

> 与 L1-L3 不同：不新增语法，增强现有 typed references 的**消费侧体验**。

**目标**：引用 skill 时，TS tip / hover 直接看到内容预览，不用跳文件。解决「引用对象 = 黑盒，不知道里面写了什么」的体验问题。

**现状**：`emit/types-dts.ts` 已生成带 JSDoc 的 typed overload，hover 显示标题/描述/源文件/token 统计，但**没有内容**——根因是 `emitTypesDts()` 只接收 `SkillMeta[]`，而 `SkillMeta` 不含 runtime 内容（pipeline 里 transform 后直接 `emitRuntime` 写文件，内容没进 metadata）。

**设计 A：JSDoc 内容预览**（核心增量）

1. `pipeline.ts` 循环里收集 `contentMap: Map<path, runtimeContent>`，传入 `emitTypesDts`。
2. `jsDoc()` 在 token 统计后追加「内容预览」段，取 runtime 内容前 `previewLines` 行（默认 3，可配）。
3. 转义：内容中 `*/` → `*\/`（防 JSDoc 提前终止）；行前缀 ` * ` 由生成器统一加。
4. 超过 `previewLines` → 追加 `…（共 N 行）`。

目标形态：

```ts
/**
 * **章节规划（Section Plan）**
 *
 * 章节级 prompt：定位 + 亲密度推进 + 场景方向
 *
 * `skill("/galgame/section-plan")`  →  Skill
 *
 * 📄 skills/galgame/section-plan/SKILL.md
 *
 * **当前文件** | 字符数 `12,340` | Token `~3,085`
 * **预计编译后** | 字符数 `8,100` (-34.3%) | Token `~2,025` (-34.3%)
 *
 * ── 内容预览（前 3 行）──
 * 【本节位置】本章第 {{sectionIndex}}/{{totalSections}} 节（…）
 * {{isFinaleHint}}
 * 【亲密度】当前={{intimacy}}（{{intimacyDesc}}）{{zeroState}}
 * …（共 96 行）
 */
export function skill(path: "/galgame/section-plan"): import("review-skill").SkillRef;
```

**设计 B：快速引用对象索引**（可选，默认关）

`skill.config.js` 开 `emitIndex: true` 时，产物追加命名导出集合：

```ts
/** path → SkillRef 索引 */
export const _skills: Record<SkillPath, import("review-skill").SkillRef> = {
  "/galgame/section-plan": skill("/galgame/section-plan"),
  // …
};
```

取舍：`_skills[...]` 让「遍历全部 skill / 按 key 快速访问」更直接，hover 落在对象上；代价是 import 即全量加载内容。review-skill 定位是「按需 `skill(path)`」，故默认关。

**改动点**：`pipeline.ts` 收集并传 contentMap；`emit/types-dts.ts` 加预览段 + 转义；`types.ts`/config 加 `previewLines`、`emitIndex`；`cli.ts` 透传；测试覆盖预览转义（`*/`）、截断、`emitIndex` 产物。

## 5. Protocol Zero 模板拆解示例（落地形态）

不是 25 变量平铺一个大文件，而是拆成 3 层：

```
skills/galgame/section-plan/SKILL.md      ← 主 prompt：静态铁律 + 结构标签 + 引用 + 条件块
skills/galgame/_fragments/intimacy.md     ← 亲密度 0-7 查表（描述/肢体接触/零状态），@ref 复用
skills/galgame/_fragments/relationship-events.md  ← 可选事件模板
```

主 prompt（示意）：

```md
---
variables:
  - name: intimacy            # 当前亲密度
    required: true
    estimateTokens: 8
  - name: isFinaleHint        # 最后一节收束提示
    required: false
    estimateTokens: 60
  - name: handoffCtx          # 上下文包：prevHandoff + prevScene + establishedFacts
    required: true
    estimateTokens: 1500
  # …其余收敛为上下文包
---
【本节位置】本章第 {{sectionIndex}}/{{totalSections}} 节（最后一节=归家就寝+睡前内心戏）
{{isFinaleHint}}
{{handoffCtx}}
【亲密度】当前={{intimacy}}（@ref: fragments/intimacy#{{intimacy}}）
【本章目标亲密度】=…（{{targetIntimacy}}）——禁止一整章停在当前级不推进。
【肢体接触（按当前亲密度）】@ref: fragments/intimacy-physical
本节: {{sectionTitle}} | 氛围={{sectionAtmosphere}} | 地点意图={{locationIntent}}
【本节场景内容】{{currentScene}} — 禁止凭空虚构场景中不存在的道具。
【本节方向】{{direction}}
【已确立设定（保持一致，禁止改名/矛盾）】{{establishedFacts}}
```

**变量收敛：25 → ~10**。四个大 payload（`prevHandoffCtx`、`prevSceneCtx`、`establishedFacts`、`currentScene`）按语义归并成 2-3 个上下文包，减的是开发者的注入面，不是模型的文本量。

## 6. 测试计划

| 层次 | 用例 |
|------|------|
| L1 | 未声明变量→error；required 缺失→error；required:false 未用→warn；`{{ 空格}}`/嵌套畸形→error；metadata.variables 输出正确 |
| L2 | 单层引用展开；嵌套引用递归展开；锚点小节提取；`_fragments/` 不产出 runtime/metadata；缺失目标→error；循环→error+链路 |
| L3 | `{{#if}}` 配对校验；空/非空展开正确；inject 未提供 required→throw；injectedTokens 汇总正确；CLI 报告列存在 |
| 回归 | 现有 18 CLI + 13 config + 各类 emit/pipeline 测试不破 |

## 7. 开放问题

1. **frontmatter 解析**：现在 `parse.ts` 只做 remark-parse，frontmatter 需加 `remark-frontmatter` + YAML 解析（`yaml` 包）→ 依赖 +2。可否用 `skill.config.js` 全局声明 + 文件内 `<!-- @variables: ... -->` 注释代替，零依赖？
2. **`@ref:` 与 strip 顺序**：展开应在 transform 后（引用内容也应过 strip）；但锚点定位发生在 mdast 层。先定位再 transform 还是先 transform 再定位？——倾向先 transform 各文件，再在字符串/文本层做锚点与展开（避免 mdast 跨文件拼接的复杂度）。
3. **`inject()` 类型强约束**：L1 用 `Record<string, string>`，后续是否给每个 skill 生成 per-skill 的变量类型接口（进 `emit/types-dts.ts`）？建议 0.4.0 再做，保持 0.3 轻。
4. **`_fragments/` 命名**：`_fragments` vs `fragments` vs `refs/`——下划线前缀与常见「私有/内部」约定一致，取 `_fragments`。

## 8. 实施顺序建议

1. **L1**（一个 PR，~半天）：`variables.ts` + schema + i18n + 测试。立刻止血 P1。
2. **L2**（一个 PR）：`refs.ts` + pipeline 多遍 resolve + discover 过滤。动 pipeline 主干，单独 PR 降低回归面。
3. **L3**（可并入 L1 或单开）：注入后 token 估算。依赖 L1 schema 的 `estimateTokens` 字段。

每个 PR 保持现有测试绿 + 新增用例；`inject()` 从 L1 就暴露，但完整语义到 L3 才闭环。
