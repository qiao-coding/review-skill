/**
 * Review Skill Tip — `@` completion + `@/path` hover preview for markdown.
 *
 * The `@` trigger character makes completion fire the moment `@` is typed,
 * sidestepping markdown's word separators (which is why plain snippets never
 * surface for `@/`). Data comes from `.skill/metadata.json` + `.skill/runtime/`.
 */
import * as vscode from "vscode";
import { loadSkills, resolveRuntimeFile, previewLines, mentionStart, MENTION_RE } from "./core";

function workspaceRoot(): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
}

/** Range of the `@...` mention under the cursor, or undefined outside one. */
function mentionRange(document: vscode.TextDocument, position: vscode.Position): vscode.Range | undefined {
  const start = mentionStart(document.lineAt(position.line).text, position.character);
  if (start < 0) return undefined;
  return new vscode.Range(position.line, start, position.line, position.character);
}

export function activate(context: vscode.ExtensionContext) {
  // Visible activation signal — the extension contributes no commands/UI, so
  // without this there's no way to tell it loaded or how many skills it found.
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(statusBar);

  const refreshStatus = () => {
    const skills = loadSkills(workspaceRoot());
    statusBar.text = `$(book) review-skill: ${skills.length} skills`;
    statusBar.tooltip = skills.length
      ? skills.map((s) => s.path).join("\n")
      : "No .skill/metadata.json — run `npx review-skill` to compile.";
    statusBar.show();
  };
  refreshStatus();
  // Re-read when the workspace root changes (e.g. a folder is opened after launch).
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(refreshStatus));

  // ── Completion: type `@` → list every compiled skill/resource ──
  // Load per request so skills reflect the current workspace root even if the
  // extension activated before the target folder was opened.
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "markdown",
      {
        provideCompletionItems(document, position) {
          const root = workspaceRoot();
          const skills = loadSkills(root);
          const range = mentionRange(document, position) ?? new vscode.Range(position, position);

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
        const range = mentionRange(document, position);
        if (!range) return;
        const mention = document.getText(range);
        if (!MENTION_RE.test(mention)) return;
        const path = mention.slice(1); // strip "@"
        const root = workspaceRoot();
        const skill = loadSkills(root).find((s) => s.path === path);
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
