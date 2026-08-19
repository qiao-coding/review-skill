# Review Skill Tip

`@` completion + `@/path` hover preview for markdown, backed by the compiled output of [review-skill](../review-skill).

## 为什么需要它

在 Markdown 里输入 `@` / `@/` 没有补全，是因为 `@` 和 `/` 都是 Markdown 的 word 分隔符——VS Code 的补全引擎只对「正在输入的词」（word 字符）弹窗，snippet 靠这个机制匹配前缀，所以带 `@` 前缀的 snippet 永远触发不了。

本扩展用 **CompletionProvider 的触发字符**（第三参数 `"@"`）显式声明「输入 `@` 立即弹补全」——这是标准做法，与 word 分隔符无关。

## 功能

- **补全**：输入 `@` → 列出全部编译后的 skill / resource（`@/galgame/section-plan` 样式），显示标题、描述。
- **Hover**：悬停在 `@/galgame/section-plan` 上 → 显示标题 + 描述 + 编译后内容前 4 行预览。

数据来源：项目根 `.skill/metadata.json` + `.skill/runtime/`（`npm run skill:build` 生成）。

## 使用前提

打开的工作区根目录下必须先编译过：

```bash
npx review-skill          # 或 npm run skill:build
```

## 开发调试（F5）

1. VS Code 打开本目录（`packages/vscode-review-skill`）
2. `F5` 启动 Extension Development Host
3. 在 dev host 里 `File → Open Folder` 打开一个编译过的项目（如 `demo-agent`）
4. 打开任意 `.md`，输入 `@` 试补全，悬停 `@/security` 试预览

## 打包安装（可选）

```bash
npx @vscode/vsce package --no-dependencies
code --install-extension review-skill-tip-0.1.0.vsix
```

## 测试

```bash
npm install
npm test                 # vitest，测 core 纯逻辑
npm run build            # tsc → out/
```
