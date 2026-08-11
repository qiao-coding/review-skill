import { skill } from "@review-skill/skill";

const root = skill("/");
const rules = skill("/react/rules/state.md");

console.log(root.meta.title, root.meta.runtime.tokens);
console.log(rules.meta.title, rules.meta.runtime.tokens);
