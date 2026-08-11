import { defineConfig } from "@review-skill/core";

export default defineConfig({
  skillsDir: "skills",
  outputDir: ".skill",
  strip: {
    comment: true,
    formatting: true,
    image: true,
    blockquote: true,
    thematicBreak: true,
    bullet: true,
    whitespace: true,
  },
});
