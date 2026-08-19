# strip：字符 token 数组

`strip` 指定编译时剥离哪些 markdown 元素。**推荐用法是字符 token 数组**——直接列出你想剥离的 markdown 语法字面量，TS 自动补全（`StripToken` 联合类型），简短且容易扩展。**默认（不配置 strip）就是什么都不清，按原文件返回。**

## 用法

```ts
import { defineConfig } from "review-skill";

export default defineConfig({
  strip: [
    "<!-- HTML -->", // HTML 注释
    "**bold**",       // 加粗
    "*italic*",       // 斜体
    "~~strikethrough~~",
    "![alt](url)",    // 图片
    "> quote",        // 引用块
    "---",            // 水平线
    "- item",         // 无序列表标记
    "\n\n",           // 多余空行、行尾空格
  ],
});
```

- **不配置 strip** → 不剥离任何内容，按原文件返回。
- `strip: []` → 同样不剥离任何内容。
- 数组里只列你想剥离的——**没列的就是保留的**。
- 用 `STRIP_TOKENS` 哈希组织（`review-skill` 导出），符号带英文名字方便阅读：

```ts
import { STRIP_TOKENS, STRIP_ALL } from "review-skill";
// STRIP_TOKENS.comment === "<!-- HTML -->"
// STRIP_ALL === 上面全部 9 个 token 的数组
```

## token 表

| token | 含义 |
|---|---|
| `"<!-- HTML -->"` | HTML 注释 `<!-- ... -->` |
| `"**bold**"` | 加粗/strong |
| `"*italic*"` | 斜体/emphasis |
| `"~~strikethrough~~"` | 删除线/delete |
| `"![alt](url)"` | 图片 |
| `"> quote"` | 引用块 |
| `"---"` | 水平线 |
| `"- item"` | 无序列表标记 |
| `"\n\n"` | 多余空行、行尾空格 |

## 与旧对象形式的映射

| 旧形式 | 新形式 |
|---|---|
| `{ comment: true }` | 包含 `"<!-- HTML -->"` |
| `{ formatting: true }` | 包含 `"**bold**"` `"*italic*"` `"~~strikethrough~~"` |
| `{ image: true }` | 包含 `"![alt](url)"` |
| `{ blockquote: true }` | 包含 `"> quote"` |
| `{ thematicBreak: true }` | 包含 `"---"` |
| `{ bullet: true }` | 包含 `"- item"` |
| `{ whitespace: true }` | 包含 `"\n\n"` |

> 语义差异：对象形式未写明的字段**默认 true（剥离）**；数组形式**只剥离列出的**，其余保留。迁移时把想剥离的写全，想保留的不写。

## 迁移示例

```ts
// 旧（已弃用，编译时发警告）
strip: { comment: true, formatting: false, image: true, blockquote: true, thematicBreak: true, bullet: true, whitespace: true },

// 新（等价：只剥离格式化之外的一切 → 实际是保留格式化）
strip: ["<!-- HTML -->", "![alt](url)", "> quote", "---", "- item", "\n\n"],
```

对象形式仍可用且行为不变（保留兼容），但会产生一条弃用警告，附带你的配置等价的 token 数组建议。

## 备注

- 删除线 `~~` 依赖 remark-gfm 才能被解析剥离；未启用时 `~~text~~` 作为字面文本保留。
- `strip` 数组元素是精确字面量，TS 会校验拼写（`StripToken` 联合类型）。
