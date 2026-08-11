import fg from "fast-glob";
import { resolve } from "node:path";

export interface DiscoveredFile {
  relativePath: string;
  absolutePath: string;
  isSkill: boolean;
  parentSkill: string | null;
}

export async function discover(skillsDir: string): Promise<DiscoveredFile[]> {
  const resolvedDir = resolve(skillsDir);

  const files = await fg("**/*.md", {
    cwd: resolvedDir,
    absolute: true,
    onlyFiles: true,
  });

  const normalizedDir = resolvedDir.replace(/\\/g, "/");

  return files.map((absPath) => {
    const normalizedAbs = absPath.replace(/\\/g, "/");
    // Strip the base directory prefix to get the relative path
    let relativePath = normalizedAbs.startsWith(normalizedDir + "/")
      ? normalizedAbs.slice(normalizedDir.length + 1)
      : normalizedAbs.replace(normalizedDir, "").replace(/^\//, "");

    const parts = relativePath.split("/");
    const fileName = parts[parts.length - 1]!;
    const isSkill = fileName === "SKILL.md";

    let parentSkill: string | null = null;
    if (parts.length > 1) {
      parentSkill = "/" + parts.slice(0, -1).join("/");
    } else if (isSkill) {
      parentSkill = null; // root SKILL.md has no parent
    } else {
      parentSkill = null; // top-level resource
    }

    return {
      relativePath,
      absolutePath: normalizedAbs,
      isSkill,
      parentSkill,
    };
  });
}

export function fileToPath(file: DiscoveredFile): string {
  if (file.isSkill) {
    // SKILL.md at root → "/"
    // SKILL.md in review/ → "/review"
    const dir = file.relativePath.replace(/\/?SKILL\.md$/, "");
    return dir === "" ? "/" : "/" + dir;
  }
  // rules.md → "/rules.md"
  // review/rules.md → "/review/rules.md"
  return "/" + file.relativePath;
}
