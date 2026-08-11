import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { SkillMeta } from "@review/core";

export async function emitMetadata(
  entries: SkillMeta[],
  outputDir: string
): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const metadataPath = join(outputDir, "metadata.json");
  await writeFile(metadataPath, JSON.stringify(entries, null, 2), "utf-8");
}
