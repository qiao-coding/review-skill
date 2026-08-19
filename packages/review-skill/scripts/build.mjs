import * as esbuild from "esbuild";
import { execSync } from "child_process";

// 1. TypeScript declarations (types only, no JS)
execSync("npx tsc --emitDeclarationOnly", { stdio: "inherit" });

// 2. Bundle + minify CLI entry
await esbuild.build({
  entryPoints: ["src/cli.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/cli.js",
  minify: true,
  sourcemap: false,
  target: "node22",
  external: [
    // Node built-ins — keep external
    "node:*",
    // Runtime deps — keep external so users get deduped copies
    "fast-glob",
    "unified",
    "remark-parse",
    "remark-stringify",
    "remark-frontmatter",
    "mdast-util-to-string",
    "unist-util-visit",
    "yaml",
  ],
});

// 3. Bundle + minify library entry
await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/index.js",
  minify: true,
  sourcemap: false,
  target: "node22",
  external: ["node:*"],
});

// Clean up tsc artifacts (we only need .d.ts, not .js)
import { rm } from "fs/promises";
await rm("dist/compiler", { recursive: true, force: true });

console.log("Build complete — minified + no sourcemaps");
console.log(`  dist/cli.js   ${(await import("fs")).statSync("dist/cli.js").size.toLocaleString()} bytes`);
console.log(`  dist/index.js ${(await import("fs")).statSync("dist/index.js").size.toLocaleString()} bytes`);
