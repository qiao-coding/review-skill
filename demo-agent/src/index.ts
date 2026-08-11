/**
 * Demo AI Code Review Agent
 *
 * Hover any skill("/...") call to see token stats in your IDE.
 * All types come from .skill/types.d.ts via module augmentation.
 */

import { skill } from "review-skill";

async function reviewCode(req: { files: Array<{ path: string; content: string }> }) {
  const rootSkill      = skill("/");
  const reactSkill     = skill("/react");
  const securitySkill  = skill("/security");
  const stateRules     = skill("/react/rules/state.md");
  const effectRules    = skill("/react/rules/effects.md");
  const owaspRef       = skill("/security/owasp.md");

  const skills = [rootSkill, reactSkill, securitySkill, stateRules, effectRules, owaspRef];

  console.log("=== Agent Context Loaded ===");
  for (const s of skills) {
    console.log(`  ${s.meta.title.padEnd(30)} ${s.meta.runtime.tokens} tokens`);
  }

  const total = skills.reduce((sum, s) => sum + s.meta.runtime.tokens, 0);
  console.log(`\nTotal context: ~${total} tokens\n`);

  const issues: string[] = [];
  for (const file of req.files) {
    if (/dangerouslySetInnerHTML/.test(file.content)) {
      issues.push(`[HIGH] ${file.path} — XSS Prevention (see /security)`);
    }
    if (/SELECT \* FROM.*\$\{/.test(file.content)) {
      issues.push(`[CRITICAL] ${file.path} — SQL Injection (see /security)`);
    }
  }

  return issues;
}

const result = await reviewCode({
  files: [
    {
      path: "src/components/Profile.tsx",
      content: `<div dangerouslySetInnerHTML={{ __html: user.bio }} />`,
    },
    {
      path: "src/api/users.ts",
      content: "const query = `SELECT * FROM users WHERE id = ${id}`;",
    },
  ],
});

console.log(`=== Found ${result.length} issue(s) ===\n`);
for (const issue of result) { console.log(issue); }
