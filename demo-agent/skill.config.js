import { defineConfig } from "review-skill";

export default defineConfig({
  /** Directory containing your skill markdown files */
  skillsDir: "skills",

  /** Output directory for compiled artifacts */
  outputDir: ".skill",

  /** Markdown elements to strip — character-based token array (TS-hinted). */
  /** Delete entries you want KEPT. Omit strip entirely to return the original file. */
  strip: [
    "<!-- HTML -->", // HTML comments
    "**bold**",       // bold
    "*italic*",       // italic
    "~~strikethrough~~",
    "![alt](url)",    // images
    "> quote",        // blockquotes
    "---",            // horizontal rules
    "- item",         // bullet markers
    "\n\n",           // blank-line collapse
  ],
});
