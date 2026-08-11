import type { Root, Heading, Paragraph, Text } from "mdast";
import { toString } from "mdast-util-to-string";

export interface AnalysisResult {
  title: string;
  description: string;
  headingTree: string[];
}

export function analyze(ast: Root): AnalysisResult {
  let title = "";
  let description = "";
  const headingTree: string[] = [];

  for (const node of ast.children) {
    if (node.type === "heading" && (node as Heading).depth === 1 && !title) {
      title = toString(node as Heading);
      headingTree.push(title);
    } else if (node.type === "paragraph" && !description && title) {
      description = toString(node as Paragraph).trim();
    } else if (node.type === "heading") {
      const h = node as Heading;
      headingTree.push(`${"  ".repeat(h.depth - 1)}${toString(h)}`);
    }
  }

  return { title, description, headingTree };
}
