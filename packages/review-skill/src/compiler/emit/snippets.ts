import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { SkillMeta } from "../../types.js";

/**
 * Generate `.vscode/skills.code-snippets` — zero-install `@` completion.
 * Each skill/resource becomes one snippet with `prefix`/`body` = `@<path>`
 * (e.g. `@/galgame/section-plan`), so typing `@` in any Markdown file
 * surfaces the skill path + title. Regenerated on every build.
 */
export async function emitSnippets(entries: SkillMeta[], vscodeDir: string): Promise<void> {
  const snippets: Record<string, { prefix: string; body: string; description: string }> = {};

  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));

  for (const entry of sorted) {
    const mention = `@${entry.path}`;
    const label = entry.path === "/" ? entry.title : `${entry.path} → ${entry.title}`;
    snippets[mention] = {
      prefix: mention,
      body: mention,
      description: label,
    };
  }

  await mkdir(vscodeDir, { recursive: true });
  await writeFile(
    join(vscodeDir, "skills.code-snippets"),
    JSON.stringify(snippets, null, 2) + "\n",
    "utf-8"
  );
}
