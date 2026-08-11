import { defineConfig } from "review-skill";

export default defineConfig({
  skillsDir: "skills",
  outputDir: ".skill",
  strip: {
    comment: true,        // <!-- HTML 注释 -->
    formatting: true,     // **加粗** *斜体* ~~删除线~~
    image: true,          // ![图片](url)
    blockquote: true,     // > 引用
    thematicBreak: true,  // --- 分割线
    bullet: true,         // * - + 列表符
    whitespace: true,     // 多余空行、行尾空格
  },
});
