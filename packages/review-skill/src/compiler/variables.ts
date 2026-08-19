import { visit } from "unist-util-visit";
import { parse as parseYaml } from "yaml";
import type { Root } from "mdast";
import type { VariableDecl } from "../types.js";
import { TEMPLATE_VAR_PATTERN } from "../skill.js";
import { msg } from "../i18n.js";

// Anything left inside {{...}} after valid placeholders were removed is malformed.
const MALFORMED_RE = /\{\{([^{}\n]*)\}\}/g;

export interface FrontmatterRange {
  start: number;
  end: number;
}

export interface ValidationResult {
  variables: VariableDecl[];
  warnings: string[];
  errors: string[];
}

/** Position of the frontmatter `yaml` node, if the file has one. */
export function frontmatterRange(root: Root): FrontmatterRange | null {
  for (const node of root.children) {
    if (
      (node as any).type === "yaml" &&
      node.position?.start?.offset != null &&
      node.position?.end?.offset != null
    ) {
      return { start: node.position.start.offset, end: node.position.end.offset };
    }
  }
  return null;
}

/**
 * Collect {{name}} placeholders from prose. Code blocks / inline code / HTML are
 * excluded automatically — their content lives in `.value`, with no text children.
 */
export function scanTemplateVariables(root: Root): { used: string[]; malformed: string[] } {
  const used = new Set<string>();
  const malformed = new Set<string>();
  const re = new RegExp(TEMPLATE_VAR_PATTERN, "g");
  const badRe = new RegExp(MALFORMED_RE.source, "g");

  visit(root, "text", (node) => {
    const text = (node as any).value as string;
    const cleaned = text.replace(re, (_m, name) => {
      used.add(name);
      return "";
    });
    for (const m of cleaned.matchAll(badRe)) malformed.add(m[0]);
  });

  return { used: [...used], malformed: [...malformed] };
}

/** Parse the `variables` contract from a YAML frontmatter node. */
export function parseVariableContract(
  root: Root
): { variables: VariableDecl[]; errors: string[] } {
  const fm = root.children.find((n) => (n as any).type === "yaml") as any;
  if (!fm) return { variables: [], errors: [] };

  let data: unknown;
  try {
    data = parseYaml(fm.value ?? "");
  } catch {
    return { variables: [], errors: [msg("errorFrontmatterParse")] };
  }

  const list = (data as any)?.variables;
  const errors: string[] = [];
  if (!Array.isArray(list)) {
    if (list !== undefined) errors.push(msg("errorFrontmatterNoVariables"));
    return { variables: [], errors };
  }

  const variables: VariableDecl[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const name = (item as any)?.name;
    if (typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      errors.push(msg("errorFrontmatterInvalidEntry", JSON.stringify(item)));
      continue;
    }
    if (seen.has(name)) {
      errors.push(msg("errorFrontmatterDuplicate", name));
      continue;
    }
    seen.add(name);
    variables.push({
      name,
      required: (item as any).required !== false, // default true — declared means enforced
      hint: typeof (item as any).hint === "string" ? (item as any).hint : undefined,
    });
  }
  return { variables, errors };
}

/** Validate template placeholders against the frontmatter contract. */
export function validateVariables(root: Root): ValidationResult {
  const { variables, errors: contractErrors } = parseVariableContract(root);
  const { used, malformed } = scanTemplateVariables(root);
  const errors = [...contractErrors];
  const warnings: string[] = [];
  const declared = new Set(variables.map((d) => d.name));

  for (const tok of malformed) errors.push(msg("errorMalformed", tok));

  // No contract at all: placeholders are unguarded → hard error (force declaration).
  if (variables.length === 0) {
    if (used.length > 0) {
      errors.push(msg("errorNoFrontmatter", used.join(", ")));
    }
    return { variables: [], warnings, errors };
  }

  for (const name of used) {
    if (!declared.has(name)) errors.push(msg("errorUndeclared", name));
  }
  for (const d of variables) {
    if (d.required && !used.includes(d.name)) {
      errors.push(msg("errorRequiredUnused", d.name));
    } else if (!d.required && !used.includes(d.name)) {
      warnings.push(msg("warnDeclaredUnused", d.name));
    }
  }
  return { variables, warnings, errors };
}
