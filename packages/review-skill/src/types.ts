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
/**
 * Character-based `strip` — list the markdown tokens to strip, organized as a
 * hash so each symbol carries a readable English name:
 *
 * ```ts
 * strip: ["<!-- HTML -->", "**bold**", "*italic*"]  // HTML comments, bold, italic
 * strip: []                                         // strip nothing
 * strip: STRIP_ALL                                  // strip every element
 * ```
 * When `strip` is not configured the original file content is returned
 * untouched (frontmatter aside). TS autocompletes these exact literals and
 * rejects anything unknown.
 */
export const STRIP_TOKENS = {
  /** HTML comments: `<!-- ... -->` */
  comment: "<!-- HTML -->",
  /** Bold / strong: `**text**` */
  strong: "**bold**",
  /** Italic / emphasis: `*text*` */
  emphasis: "*italic*",
  /** Strikethrough: `~~text~~` */
  delete: "~~strikethrough~~",
  /** Images: `![alt](url)` */
  image: "![alt](url)",
  /** Blockquotes: `> text` */
  blockquote: "> quote",
  /** Horizontal rules: `---` `***` `___` */
  thematicBreak: "---",
  /** Unordered-list markers: `- ` `* ` `+ ` */
  bullet: "- item",
  /** Extra blank lines and trailing whitespace */
  whitespace: "\n\n",
} as const;

export type StripToken = (typeof STRIP_TOKENS)[keyof typeof STRIP_TOKENS];

/** The character-based strip spec: an array of markdown syntax tokens. */
export type Strip = StripToken[];

/** Strip every supported markdown element — the explicit equivalent of the legacy default. */
export const STRIP_ALL: Strip = [
  STRIP_TOKENS.comment,
  STRIP_TOKENS.strong,
  STRIP_TOKENS.emphasis,
  STRIP_TOKENS.delete,
  STRIP_TOKENS.image,
  STRIP_TOKENS.blockquote,
  STRIP_TOKENS.thematicBreak,
  STRIP_TOKENS.bullet,
  STRIP_TOKENS.whitespace,
];

/**
 * Which markdown elements to strip during compilation. All default to true.
 * @deprecated Use the character-based `Strip` token array instead (see `STRIP_TOKENS`).
 *   The compiler emits a deprecation warning with the exact equivalent tokens when
 *   this object form is used. Migration: `strip: { formatting: false }` →
 *   `strip: ["<!-- -->", ">", "![]", "---", "- ", "\n\n"]` (whatever you want kept, omit).
 */
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
