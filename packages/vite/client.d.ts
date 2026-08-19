/**
 * Ambient types for `@skill/*` virtual modules provided by the
 * review-skill Vite plugin. Reference it from tsconfig:
 *
 *   "compilerOptions": { "types": ["@review-skill/vite/client"] }
 *
 * or add `/// <reference types="@review-skill/vite/client" />` to a d.ts.
 */
/// <reference types="vite/client" />

declare module "@skill/meta" {
  import type { SkillMeta } from "review-skill";
  /** Compiled `metadata.json` — every skill/resource in the project. */
  const meta: SkillMeta[];
  export default meta;
}

declare module "@skill/*" {
  /** Compiled runtime content of one skill/resource, `@/path` refs inlined. */
  const content: string;
  export default content;
}
