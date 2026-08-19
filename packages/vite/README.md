# @review-skill/vite

把 review-skill 变成**框架**：编译后的 skill 是一等公民模块，像 import 普通模块一样消费，TS 原生给补全和 JSDoc hover（无需编辑器扩展）。

## 安装

```bash
npm i -D @review-skill/vite
```

## 使用

```ts
// vite.config.ts
import { skillFramework } from "@review-skill/vite";
export default defineConfig({
  plugins: [skillFramework()], // 默认编译 skills/ → .skill/
});
```

```ts
// 任意应用代码
import plan from "@skill/galgame/section-plan"; // 编译后 runtime 内容，markdown 链接自动内联
import meta from "@skill/meta";                 // SkillMeta[]（metadata.json）
```

类型：tsconfig 加

```json
"compilerOptions": { "types": ["@review-skill/vite/client"] }
```

## 行为

- **自动编译**：首次解析配置时，若 `.skill/metadata.json` 缺失或比 `skills/**` 的任何源文件旧，自动跑一次编译器。手动 `review-skill --watch` 时不会重复编译。
- **虚拟模块**：
  - `@skill/meta` → 编译后的 `metadata.json`
  - `@skill/<path>` → 编译后 runtime 内容（frontmatter 已剥离），`[text](../path)` 链接内联为自包含模块
- **配置**：`skillFramework({ skillsDir: "skills", outputDir: ".skill" })`。

## 定位

- **编辑器 md 书写层的 tip** → 原生 markdown 链接 `[text](../path)`，VS Code 自带路径补全、Ctrl+点击跳转、悬停预览，无需扩展。
- **代码消费层的 skill 框架** → 就是这个插件。两者数据同源（`.skill/`），互不依赖。

## 开发

```bash
npm install
npm test          # vitest，测 core 纯逻辑（虚拟模块解析/读取/过期检测）
npm run build     # tsc → dist/
```
