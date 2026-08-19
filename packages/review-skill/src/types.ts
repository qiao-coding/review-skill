export type SkillPath = string;
export type ResourcePath = string;
export type SkillAddress = SkillPath | ResourcePath;

export interface SkillStats {
  characters: number;
  tokens: number;
}

/** A variable declared in a skill's frontmatter contract. */
export interface VariableDecl {
  name: string;
  required: boolean;
  hint?: string;
}

export interface SkillMeta {
  path: string;
  title: string;
  description: string;
  isSkill: boolean;
  source: SkillStats;
  runtime: SkillStats;
  files?: number;
  /** Variables declared in frontmatter (L1 variable contract). */
  variables?: VariableDecl[];
}

/**
 * A reference to a compiled skill or resource.
 *
 * Both skills (directories with SKILL.md) and resources (individual .md files)
 * share the same API surface — `.meta` for metadata and `.read()` for the
 * compiled runtime markdown.
 */
/** Which markdown elements to strip during compilation. All default to true. */
export interface StripOptions {
  /** HTML comments: <!-- ... --> */
  comment?: boolean;
  /** Bold, italic, strikethrough: ** _ ~~ */
  formatting?: boolean;
  /** Images: ![alt](url) */
  image?: boolean;
  /** Blockquotes: > text */
  blockquote?: boolean;
  /** Horizontal rules: --- *** ___ */
  thematicBreak?: boolean;
  /** Bullet markers: * - + */
  bullet?: boolean;
  /** Extra blank lines and trailing whitespace */
  whitespace?: boolean;
}

export interface SkillRef {
  readonly meta: SkillMeta;
  /** Compiled runtime markdown — sync, no I/O. */
  readonly content: string;
  /** @deprecated Use .content instead. */
  read(): Promise<string>;
  /**
   * Single self-contained context: `@/path` references in `.content` are
   * recursively inlined from compiled runtime files (cycles → `[cycle @/path]`,
   * unknown paths left as-is). Sync, no I/O beyond the compiled `.skill/` dir.
   */
  bundle(): string;
}
