import { unified } from "unified";
import remarkParse from "remark-parse";
import type { Root } from "mdast";

const parser = unified().use(remarkParse);

export function parseMarkdown(content: string): Root {
  return parser.parse(content) as unknown as Root;
}
