/**
 * review-skill as a Vite plugin — skills become first-class typed modules.
 *
 * ```ts
 * // vite.config.ts
 * import { skillFramework } from "@review-skill/vite";
 * export default defineConfig({ plugins: [skillFramework()] });
 * ```
 *
 * ```ts
 * // anywhere in app code
 * import plan from "@skill/galgame/section-plan"; // compiled runtime, refs inlined
 * import { registry } from "@skill/meta";         // SkillMeta[] (metadata.json)
 * ```
 *
 * On first config resolution the plugin (re)compiles `skills/` → `.skill/` when
 * metadata is missing or stale, then serves the output as virtual modules.
 * Types for the `@skill/*` imports come from `@review-skill/vite/client`
 * (add `"types": ["@review-skill/vite/client"]` to tsconfig, or a
 * `/// <reference types="@review-skill/vite/client" />` triple-slash).
 */
import { join } from "node:path";
import type { Plugin } from "vite";
import { compile } from "review-skill/compiler";
import {
  META_ID,
  RESOURCE_PREFIX,
  loadMeta,
  moduleForMeta,
  moduleForResource,
  needsCompile,
  resolveOutputDir,
  resolveSkillsDir,
  resolveVirtualId,
} from "./core.js";
import type { SkillFrameworkOptions } from "./core.js";
import type { SkillMeta } from "review-skill";

export type { SkillFrameworkOptions } from "./core.js";

export function skillFramework(opts: SkillFrameworkOptions = {}): Plugin {
  let outputDir = "";
  let runtimeDir = "";
  let meta: SkillMeta[] = [];

  return {
    name: "review-skill-framework",
    async configResolved(config) {
      outputDir = resolveOutputDir(config.root, opts);
      runtimeDir = join(outputDir, "runtime");
      if (needsCompile(config.root, opts)) {
        await compile(resolveSkillsDir(config.root, opts), outputDir);
      }
      meta = loadMeta(config.root, opts);
    },
    resolveId(id) {
      return resolveVirtualId(id);
    },
    load(id) {
      if (id === META_ID) return moduleForMeta(meta);
      if (id.startsWith(RESOURCE_PREFIX)) {
        return moduleForResource(runtimeDir, id.slice(RESOURCE_PREFIX.length));
      }
      return undefined;
    },
  };
}
