import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import type { Root } from "mdast";

// Only recognize `---` fences (not TOML `+++`) — variables.ts relies on the yaml node type.
const parser = unified().use(remarkParse).use(remarkFrontmatter, "yaml");

export function parseMarkdown(content: string): Root {
  return parser.parse(content) as unknown as Root;
}
