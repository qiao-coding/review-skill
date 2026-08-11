# Security Review

<!-- Maintainer: @security-team -->
<!-- Severity thresholds: Critical >= 9, High >= 7, Medium >= 5 -->

Review code for security vulnerabilities across the OWASP Top 10 and common injection vectors.

## Injection Attacks

<!-- The most common and dangerous category -->

### SQL Injection

Any string concatenation into SQL is a **critical** finding:

```ts
// ❌ CRITICAL
const query = `SELECT * FROM users WHERE id = ${userId}`;

// ✅ Use parameterized queries
const query = `SELECT * FROM users WHERE id = $1`;
```

### XSS (Cross-Site Scripting)

- **Never** use `dangerouslySetInnerHTML` without sanitization
- Sanitize all user-generated content before rendering
- Use `DOMPurify` for HTML sanitization

## Authentication & Authorization

- Check for **missing auth checks** on API routes
- JWT tokens stored in `localStorage` → flag as **high**
- Password hashing with weak algorithms (MD5, SHA1) → **critical**

## Data Exposure

- API responses returning more fields than needed
- Secrets in client-side code (API keys, tokens)
- Error messages leaking stack traces or DB schema

<!-- TODO(v2): add SAST integration for automated scanning -->

See also: `/security/owasp` for the full OWASP reference.
