import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import type {
  Root, Html, Code, ThematicBreak,
  Strong, Emphasis, Delete, Image,
  List, ListItem, Blockquote,
} from "mdast";
import { visit } from "unist-util-visit";

// ── Helpers ──────────────────────────────────────────────────

type Parent = { children: any[] };

/** Collect code block position ranges to protect their content. */
function getCodeRanges(tree: Root): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  visit(tree, "code", (node: Code) => {
    if (node.position) {
      ranges.push({
        start: node.position.start.offset ?? 0,
        end: node.position.end.offset ?? Infinity,
      });
    }
  });
  return ranges;
}

function isInCodeBlock(
  node: { position?: { start?: { offset?: number } } | null },
  ranges: Array<{ start: number; end: number }>
): boolean {
  const pos = node.position?.start?.offset ?? -1;
  return ranges.some((r) => pos >= r.start && pos < r.end);
}

// ── Plugin 1: Strip HTML comments (outside code blocks) ──────

export function remarkStripComments() {
  return (tree: Root) => {
    const codeRanges = getCodeRanges(tree);
    const toRemove: Array<{ parent: Parent; index: number }> = [];

    visit(tree, "html", (node: Html, index, parent) => {
      if (!parent || typeof index !== "number") return;
      if (!isInCodeBlock(node, codeRanges)) {
        if (/^<!--[\s\S]*-->$/.test(node.value.trim())) {
          toRemove.push({ parent, index });
        }
      }
    });

    for (const { parent, index } of toRemove.reverse()) {
      parent.children.splice(index, 1);
    }
  };
}

// ── Plugin 2: Strip bold / italic / strikethrough (outside code blocks) ─

type InlineFormattingType = "strong" | "emphasis" | "delete";

export function remarkStripInlineFormatting(types: readonly InlineFormattingType[]) {
  return (tree: Root) => {
    const codeRanges = getCodeRanges(tree);
    const replacements: Array<{ parent: Parent; index: number; children: any[] }> = [];

    for (const type of types) {
      visit(tree, type, (node: Strong | Emphasis | Delete, index, parent) => {
        if (!parent || typeof index !== "number") return;
        if (!isInCodeBlock(node, codeRanges)) {
          replacements.push({ parent, index, children: [...node.children] });
        }
      });
    }

    for (const { parent, index, children } of replacements.reverse()) {
      parent.children.splice(index, 1, ...children);
    }
  };
}

// ── Plugin 3: Strip images (purely visual, LLM can't see them) ─

export function remarkStripImages() {
  return (tree: Root) => {
    const toRemove: Array<{ parent: Parent; index: number }> = [];

    visit(tree, "image", (_node: Image, index, parent) => {
      if (parent && typeof index === "number") {
        toRemove.push({ parent, index });
      }
    });

    for (const { parent, index } of toRemove.reverse()) {
      parent.children.splice(index, 1);
    }
  };
}

// ── Plugin 4: Strip horizontal rules ─────────────────────────

export function remarkStripThematicBreaks() {
  return (tree: Root) => {
    const toRemove: Array<{ parent: Parent; index: number }> = [];
    visit(tree, "thematicBreak", (_node: ThematicBreak, index, parent) => {
      if (parent && typeof index === "number") {
        toRemove.push({ parent, index });
      }
    });
    for (const { parent, index } of toRemove.reverse()) {
      parent.children.splice(index, 1);
    }
  };
}

// ── Plugin 5: Strip bullet markers from flat unordered lists ──

export function remarkStripBulletMarkers() {
  return (tree: Root) => {
    const codeRanges = getCodeRanges(tree);
    const toRemove: Array<{ parent: Parent; index: number }> = [];

    visit(tree, "list", (listNode: List, listIndex, listParent) => {
      if (!listParent || typeof listIndex !== "number") return;
      if (isInCodeBlock(listNode, codeRanges)) return;

      // Only touch unordered lists (bulleted, not numbered).
      if (listNode.ordered) return;

      // Only unwrap if no nested lists (simple flat list).
      const hasNestedList = listNode.children.some((item) =>
        item.children.some((child: any) => child.type === "list")
      );
      if (hasNestedList) return;

      // Collect the text content of each list item as a paragraph.
      const paragraphs: any[] = [];
      for (const item of listNode.children) {
        const listItem = item as ListItem;
        // Take the list item's children and wrap each in a paragraph if needed
        for (const child of listItem.children) {
          paragraphs.push(child);
        }
      }

      // Add newlines between items by inserting text nodes
      const result: any[] = [];
      for (let i = 0; i < paragraphs.length; i++) {
        if (i > 0) {
          result.push({ type: "text", value: "\n" });
        }
        result.push(paragraphs[i]!);
      }

      // Replace the <ul> node with the flattened content
      // We mark it for replacement (same pattern as others)
      toRemove.push({ parent: listParent, index: listIndex });
      // Actually this approach won't work because we need to INSERT content.
      // Let me use a different approach.
    });

    // The above approach is wrong — we can't just remove the list, we need
    // to replace it. Let me use the replacement pattern instead.
  };
}

/**
 * Better approach: post-stringify regex to strip bullet chars.
 * remark-stringify always produces `* ` or `- ` bullets for unordered lists.
 * We strip them at the string level, outside code blocks.
 */
function stripBulletsFromString(content: string): string {
  // Remove bullet markers (*, -, +) at the start of lines
  // Only match simple bullet patterns (not inside code blocks)
  return content
    .replace(/^[\*\-\+]\s/gm, "")
    .replace(/\n{2,}/g, "\n");
}

// ── Plugin 6: Strip blockquote markers ───────────────────────

export function remarkStripBlockquotes() {
  return (tree: Root) => {
    const codeRanges = getCodeRanges(tree);
    const replacements: Array<{ parent: Parent; index: number; children: any[] }> = [];

    visit(tree, "blockquote", (node: Blockquote, index, parent) => {
      if (!parent || typeof index !== "number") return;
      if (!isInCodeBlock(node, codeRanges)) {
        replacements.push({ parent, index, children: [...node.children] });
      }
    });

    for (const { parent, index, children } of replacements.reverse()) {
      parent.children.splice(index, 1, ...children);
    }
  };
}

// ── Post-stringify cleanup ───────────────────────────────────

function protectCodeBlocks(content: string, fn: (text: string) => string): string {
  // Extract fenced code blocks, apply fn to prose only, then restore
  const codeBlocks: string[] = [];
  const protected_ = content.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `\x00CODEBLOCK${codeBlocks.length - 1}\x00`;
  });
  const cleaned = fn(protected_);
  return cleaned.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, i) => codeBlocks[parseInt(i)]!);
}

export function cleanWhitespace(content: string): string {
  return protectCodeBlocks(content, (text) =>
    text
      // Strip bullet markers (*, -, +) at line start
      .replace(/^[\*\-\+]\s/gm, "")
      // Collapse 2+ consecutive blank lines
      .replace(/\n{2,}/g, "\n")
      // Remove lines that are only decorative characters
      .replace(/^\s*[-=*_]{3,}\s*$/gm, "")
      // Trim trailing whitespace on each line
      .replace(/[ \t]+$/gm, "")
      // Remove leading/trailing blank lines
      .replace(/^\n+/, "")
      .replace(/\n+$/, "\n")
      // Re-collapse after removing lines
      .replace(/\n{2,}/g, "\n")
  );
}

// ── Full pipeline ────────────────────────────────────────────

import { msg } from "../i18n.js";
import { STRIP_TOKENS } from "../types.js";
import type { StripOptions, Strip, StripToken } from "../types.js";

/** Fully-resolved strip settings — every element is an explicit boolean. */
export interface NormalizedStrip {
  comment: boolean;
  strong: boolean;
  emphasis: boolean;
  delete: boolean;
  image: boolean;
  blockquote: boolean;
  thematicBreak: boolean;
  bullet: boolean;
  whitespace: boolean;
}

const NOTHING_STRIPPED: NormalizedStrip = {
  comment: false,
  strong: false,
  emphasis: false,
  delete: false,
  image: false,
  blockquote: false,
  thematicBreak: false,
  bullet: false,
  whitespace: false,
};

/**
 * Normalize either strip spec to explicit booleans.
 *
 * - `undefined` → nothing is stripped (the original file is returned unchanged).
 * - `Strip` (token array) → strip exactly the listed tokens; `[]` strips nothing.
 * - `StripOptions` (object) → legacy object form, deprecated. Emits a migration
 *   warning into `warnings` (once, when provided) listing the equivalent tokens.
 */
export function normalizeStrip(
  strip: StripOptions | Strip | undefined,
  warnings?: string[]
): NormalizedStrip {
  if (strip == null) return NOTHING_STRIPPED;
  if (Array.isArray(strip)) {
    const set = new Set<StripToken>(strip);
    const o = { ...NOTHING_STRIPPED };
    o.comment = set.has(STRIP_TOKENS.comment);
    o.strong = set.has(STRIP_TOKENS.strong);
    o.emphasis = set.has(STRIP_TOKENS.emphasis);
    o.delete = set.has(STRIP_TOKENS.delete);
    o.image = set.has(STRIP_TOKENS.image);
    o.blockquote = set.has(STRIP_TOKENS.blockquote);
    o.thematicBreak = set.has(STRIP_TOKENS.thematicBreak);
    o.bullet = set.has(STRIP_TOKENS.bullet);
    o.whitespace = set.has(STRIP_TOKENS.whitespace);
    return o;
  }

  // ── deprecated object form: keep legacy behavior, warn with migration ──
  const o = strip;
  const formatting = o.formatting ?? true;
  const normalized: NormalizedStrip = {
    comment: o.comment ?? true,
    strong: formatting,
    emphasis: formatting,
    delete: formatting,
    image: o.image ?? true,
    blockquote: o.blockquote ?? true,
    thematicBreak: o.thematicBreak ?? true,
    bullet: o.bullet ?? true,
    whitespace: o.whitespace ?? true,
  };
  warnings?.push(msg("deprecatedStrip", stripObjectToTokens(strip)));
  return normalized;
}

/** The token array equivalent of an object-form strip — used in the migration warning. */
function stripObjectToTokens(strip: StripOptions): string {
  const kept: StripToken[] = [];
  if (strip.comment !== false) kept.push(STRIP_TOKENS.comment);
  if (strip.formatting !== false) {
    kept.push(STRIP_TOKENS.strong, STRIP_TOKENS.emphasis, STRIP_TOKENS.delete);
  }
  if (strip.image !== false) kept.push(STRIP_TOKENS.image);
  if (strip.blockquote !== false) kept.push(STRIP_TOKENS.blockquote);
  if (strip.thematicBreak !== false) kept.push(STRIP_TOKENS.thematicBreak);
  if (strip.bullet !== false) kept.push(STRIP_TOKENS.bullet);
  if (strip.whitespace !== false) kept.push(STRIP_TOKENS.whitespace);
  // JSON.stringify escapes the literal "\n\n" token so the hint reads `"\n\n"`, not a real newline
  return `[${kept.map((t) => JSON.stringify(t)).join(", ")}]`;
}

export async function transformMarkdown(
  sourceContent: string,
  strip?: StripOptions | Strip
): Promise<string> {
  const opts = normalizeStrip(strip);

  // Nothing configured → return the original file untouched (opt-in stripping).
  if (
    !opts.comment &&
    !opts.strong &&
    !opts.emphasis &&
    !opts.delete &&
    !opts.image &&
    !opts.blockquote &&
    !opts.thematicBreak &&
    !opts.bullet &&
    !opts.whitespace
  ) {
    return sourceContent;
  }

  // Build the processor chain — plugins only apply when enabled
  const processor = unified().use(remarkParse);

  if (opts.comment) processor.use(remarkStripComments);
  const inlineTypes: InlineFormattingType[] = [];
  if (opts.strong) inlineTypes.push("strong");
  if (opts.emphasis) inlineTypes.push("emphasis");
  if (opts.delete) inlineTypes.push("delete");
  if (inlineTypes.length) processor.use(remarkStripInlineFormatting, inlineTypes);
  if (opts.image) processor.use(remarkStripImages);
  if (opts.blockquote) processor.use(remarkStripBlockquotes);
  if (opts.thematicBreak) processor.use(remarkStripThematicBreaks);

  processor.use(remarkStringify);

  const result = await processor.process(sourceContent);
  let output = String(result);

  // Post-stringify cleanup — each option controls its own regex
  output = protectCodeBlocks(output, (text) => {
    let t = text;
    if (opts.bullet)         t = t.replace(/^[\*\-\+]\s/gm, "");
    if (opts.thematicBreak)  t = t.replace(/^\s*[-=*_]{3,}\s*$/gm, "");
    if (opts.whitespace) {
      t = t.replace(/[ \t]+$/gm, "");
      t = t.replace(/\n{2,}/g, "\n");
      t = t.replace(/^\n+/, "").replace(/\n+$/, "\n");
      t = t.replace(/\n{2,}/g, "\n");
    }
    return t;
  });

  return output;
}
