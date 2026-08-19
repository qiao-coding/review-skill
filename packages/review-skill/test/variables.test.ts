import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../src/compiler/parse.js";
import {
  frontmatterRange,
  parseVariableContract,
  scanSkillRefs,
  scanTemplateVariables,
  validateVariables,
} from "../src/compiler/variables.js";

/** Wrap YAML in a `---` frontmatter fence (must sit at the very top of the file). */
const fm = (yaml: string) => `---\n${yaml}\n---`;

describe("parseVariableContract", () => {
  it("parses a valid contract, defaulting required to true", () => {
    const root = parseMarkdown(
      fm(`variables:\n  - name: heroName\n  - name: isFinale\n    required: false`)
    );
    const { variables, errors } = parseVariableContract(root);
    expect(errors).toEqual([]);
    expect(variables).toEqual([
      { name: "heroName", required: true },
      { name: "isFinale", required: false },
    ]);
  });

  it("returns empty when the file has no frontmatter", () => {
    const root = parseMarkdown("# Plain\n\nNo contract here.");
    const { variables, errors } = parseVariableContract(root);
    expect(variables).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("errors when the variables block is not a list", () => {
    const root = parseMarkdown(fm("variables: hello"));
    const { variables, errors } = parseVariableContract(root);
    expect(variables).toEqual([]);
    expect(errors).toEqual([expect.stringContaining("variables")]);
  });

  it("rejects entries without a valid name", () => {
    const root = parseMarkdown(fm(`variables:\n  - required: false`));
    const { variables, errors } = parseVariableContract(root);
    expect(variables).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("name");
  });

  it("drops duplicate names and reports them", () => {
    const root = parseMarkdown(fm(`variables:\n  - name: dup\n  - name: dup`));
    const { variables, errors } = parseVariableContract(root);
    expect(variables).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("dup");
  });
});

describe("scanTemplateVariables", () => {
  it("collects placeholders from prose", () => {
    const root = parseMarkdown("Hello {{name}}, welcome to {{place}}.");
    const { used, malformed } = scanTemplateVariables(root);
    expect(used).toEqual(["name", "place"]);
    expect(malformed).toEqual([]);
  });

  it("tolerates whitespace inside braces", () => {
    const root = parseMarkdown("Value: {{  name  }}.");
    const { used } = scanTemplateVariables(root);
    expect(used).toEqual(["name"]);
  });

  it("excludes code blocks and inline code", () => {
    const root = parseMarkdown(
      [
        "Use {{name}} here.",
        "```ts",
        "const x = {{codeBlock}};",
        "```",
        "And `{{inlineCode}}` should also be ignored.",
      ].join("\n")
    );
    const { used } = scanTemplateVariables(root);
    expect(used).toEqual(["name"]);
  });

  it("flags malformed placeholders", () => {
    const root = parseMarkdown("Use {{name}} but {{a-b}} and {{ }} are broken.");
    const { used, malformed } = scanTemplateVariables(root);
    expect(used).toEqual(["name"]);
    expect(malformed).toContain("{{a-b}}");
    expect(malformed).toContain("{{ }}");
  });
});

describe("validateVariables", () => {
  it("errors when placeholders are used without a contract", () => {
    const root = parseMarkdown("No contract here: {{name}}.");
    const { variables, errors, warnings } = validateVariables(root);
    expect(variables).toEqual([]);
    expect(warnings).toEqual([]);
    // Locale-agnostic: message differs between en and zh-CN, but always names the variable.
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/未声明|undeclared/);
  });

  it("errors on undeclared variables when a contract exists", () => {
    const root = parseMarkdown(
      fm(`variables:\n  - name: name`) + "\n\nHello {{name}} and {{ghost}}."
    );
    const { errors } = validateVariables(root);
    expect(errors).toEqual([expect.stringContaining("{{ghost}}")]);
  });

  it("errors when a required variable is never used", () => {
    const root = parseMarkdown(
      fm(`variables:\n  - name: unused`) + "\n\nBody without placeholders."
    );
    const { errors, warnings } = validateVariables(root);
    expect(errors).toEqual([expect.stringContaining("unused")]);
    expect(warnings).toEqual([]);
  });

  it("warns (not errors) when an optional variable is never used", () => {
    const root = parseMarkdown(
      fm(`variables:\n  - name: opt\n    required: false`) + "\n\nBody."
    );
    const { errors, warnings } = validateVariables(root);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining("opt")]);
  });

  it("passes cleanly when every placeholder is declared and used", () => {
    const root = parseMarkdown(
      fm(`variables:\n  - name: hero\n    required: false`) + "\n\nHi {{hero}}!"
    );
    const { errors, warnings } = validateVariables(root);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});

describe("scanSkillRefs", () => {
  it("collects link references from prose", () => {
    const root = parseMarkdown("See [section-plan](../galgame/section-plan) and [state](../review/rules/state.md).");
    expect(scanSkillRefs(root, "/")).toEqual(["/galgame/section-plan", "/review/rules/state.md"]);
  });

  it("skips external URLs, anchors, mailto, and image links", () => {
    const root = parseMarkdown(
      "[docs](https://example.com/a.md), [anchor](#section), [mail](mailto:a@b.com), ![diagram](../diagram.png)"
    );
    expect(scanSkillRefs(root, "/")).toEqual([]);
  });

  it("ignores references inside code blocks and inline code", () => {
    const root = parseMarkdown(
      [
        "Real ref: [section-plan](../galgame/section-plan).",
        "```ts",
        "const p = '[hidden](../hidden)';",
        "```",
        "Inline `[also-hidden](../also-hidden)` too.",
      ].join("\n")
    );
    expect(scanSkillRefs(root, "/")).toEqual(["/galgame/section-plan"]);
  });

  it("resolves relative links against the containing file's path", () => {
    // from /galgame/section-plan/SKILL.md, ../../security/SKILL.md → /security
    const root = parseMarkdown("See [security](../../security/SKILL.md).");
    expect(scanSkillRefs(root, "/galgame/section-plan/SKILL.md")).toEqual(["/security"]);
  });
});

describe("frontmatterRange", () => {
  it("returns the offset span of the frontmatter block", () => {
    const content = "---\nvariables:\n  - name: x\n---\n\nBody {{x}}";
    const root = parseMarkdown(content);
    const r = frontmatterRange(root);
    expect(r).not.toBeNull();
    expect(content.slice(r!.start, r!.end).startsWith("---")).toBe(true);
    expect(content.slice(r!.start, r!.end).endsWith("---")).toBe(true);
  });

  it("returns null when there is no frontmatter", () => {
    const root = parseMarkdown("# Plain\n\nNo frontmatter.");
    expect(frontmatterRange(root)).toBeNull();
  });
});
