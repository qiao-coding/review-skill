/**
 * Review Skill Tip — `@` completion + `@/path` hover preview for markdown.
 *
 * The `@` trigger character makes completion fire the moment `@` is typed,
 * sidestepping markdown's word separators (which is why plain snippets never
 * surface for `@/`). Data comes from `.skill/metadata.json` + `.skill/runtime/`.
 */
import * as vscode from "vscode";
import { loadSkills, resolveRuntimeFile, previewLines, MENTION_RE } from "./core";

const REF_RE = /@\/[\w/.-]*/;

export function activate(context: vscode.ExtensionContext) {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
  const skills = loadSkills(root);

  // ── Completion: type `@` → list every compiled skill/resource ──
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "markdown",
      {
        provideCompletionItems(document, position) {
          const range =
            document.getWordRangeAtPosition(position, REF_RE) ??
            new vscode.Range(position, position);

          return skills.map((s) => {
            const item = new vscode.CompletionItem(`@${s.path}`, vscode.CompletionItemKind.File);
            item.detail = s.title;
            item.documentation = s.description || undefined;
            item.insertText = `@${s.path}`;
            item.range = range;
            return item;
          });
        },
      },
      "@"
    )
  );

  // ── Hover: `@/path` → title + description + content preview ──
  context.subscriptions.push(
    vscode.languages.registerHoverProvider("markdown", {
      provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position, REF_RE);
        if (!range) return;
        const mention = document.getText(range);
        if (!MENTION_RE.test(mention)) return;
        const path = mention.slice(1); // strip "@"
        const skill = skills.find((s) => s.path === path);
        if (!skill) return;

        const content = resolveRuntimeFile(root, path, skill.isSkill);
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${skill.title}** \`${path}\``);
        if (skill.description) md.appendMarkdown(`\n\n${skill.description}`);
        if (content) {
          md.appendCodeblock(previewLines(content, 4), "markdown");
        }
        return new vscode.Hover(md, range);
      },
    })
  );
}

export function deactivate() {}
