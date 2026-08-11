import { defineConfig } from "review-skill";

export default defineConfig({
  /** Directory containing your skill markdown files */
  skillsDir: "skills",

  /** Output directory for compiled artifacts */
  outputDir: ".skill",

  /** Markdown elements to strip during compilation (all default to true) */
  strip: {
    /** <!-- HTML comments --> */
    comment: true,

    /** **bold** *italic* ~~strikethrough~~ */
    formatting: true,

    /** ![images](url) */
    image: true,

    /** > blockquotes */
    blockquote: true,

    /** --- horizontal rules */
    thematicBreak: true,

    /** * - + list bullet markers */
    bullet: true,

    /** extra blank lines and trailing whitespace */
    whitespace: true,
  },
});
