/**
 * Demo AI Code Review Agent
 *
 * Hover any skill("/...") call to see token stats in your IDE.
 */

import { skill, type SkillRef } from "../.skill/skill.js";

interface ReviewRequest {
  files: Array<{ path: string; content: string }>;
  author: string;
}

async function reviewCode(req: ReviewRequest) {
  // Each path is type-checked — try typing skill("/ in your IDE
  const rootSkill   = skill("/");
  const reactSkill  = skill("/react");
  const securitySkill = skill("/security");
  const stateRules  = skill("/react/rules/state.md");
  const effectRules = skill("/react/rules/effects.md");
  const owaspRef    = skill("/security/owasp.md");

  // One unified API: .meta for stats, .read() for markdown
  const skills = [rootSkill, reactSkill, securitySkill, stateRules, effectRules, owaspRef];

  console.log("=== Agent Context Loaded ===");
  for (const s of skills) {
    console.log(`  ${s.meta.title.padEnd(30)} ${s.meta.runtime.tokens} tokens`);
  }

  const total = skills.reduce((sum, s) => sum + s.meta.runtime.tokens, 0);
  console.log(`\nTotal context: ~${total} tokens\n`);

  // Quick scan for issues matching our skill rules
  const issues: string[] = [];
  for (const file of req.files) {
    if (/dangerouslySetInnerHTML/.test(file.content)) {
      issues.push(`[HIGH] ${file.path} — XSS Prevention (see /security)`);
    }
    if (/SELECT \* FROM.*\$\{/.test(file.content)) {
      issues.push(`[CRITICAL] ${file.path} — SQL Injection (see /security)`);
    }
  }

  return { total, issues };
}

// ── Run ──

const result = await reviewCode({
  files: [
    {
      path: "src/components/Profile.tsx",
      content: `
function Profile({ user }) {
  const [name, setName] = useState(user.first + " " + user.last);
  return <div dangerouslySetInnerHTML={{ __html: user.bio }} />;
}`,
    },
    {
      path: "src/api/users.ts",
      content: `
async function getUser(id: string) {
  const query = \`SELECT * FROM users WHERE id = \${id}\`;
  return db.query(query);
}`,
    },
  ],
  author: "demo-user",
});

console.log(`=== Found ${result.issues.length} issue(s) ===\n`);
for (const issue of result.issues) {
  console.log(issue);
}
