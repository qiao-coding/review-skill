import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export async function emitRuntime(
  skillPath: string,
  content: string,
  outputDir: string
): Promise<void> {
  // skillPath: "/review/rules.md" → output: <outputDir>/runtime/review/rules.md
  // skillPath: "/review" → output: <outputDir>/runtime/review/SKILL.md
  const relativePath = skillPath === "/"
    ? "SKILL.md"
    : skillPath.replace(/^\//, "") + (skillPath.endsWith(".md") ? "" : "/SKILL.md");

  const outPath = join(outputDir, "runtime", relativePath);
  await mkdir(join(outPath, ".."), { recursive: true });
  await writeFile(outPath, content, "utf-8");
}
