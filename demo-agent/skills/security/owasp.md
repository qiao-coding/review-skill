# OWASP Top 10 Quick Reference

<!-- Resource: /security/owasp -->

## A01: Broken Access Control

- Verify authorization on every request
- Deny by default, allow explicitly
- Rate limit sensitive endpoints

## A02: Cryptographic Failures

- Use **bcrypt/argon2** for passwords (never MD5/SHA1)
- Encrypt sensitive data at rest (AES-256-GCM)
- Never hard-code encryption keys

## A03: Injection

- **Parameterized queries** for SQL
- **ORM/ODM** with input validation
- **Never trust user input** — sanitize all external data

## A04: Insecure Design

- Threat model before implementation
- Limit resource consumption (DoS prevention)
- Validate input at server boundary

## A05: Security Misconfiguration

- Disable directory listing
- Remove default credentials
- Keep dependencies updated (`npm audit`, Dependabot)

## A06: Vulnerable Components

- Monitor CVEs for all dependencies
- Remove unused packages
- Pin versions in production

## A07: Auth Failures

- MFA for sensitive operations
- Session timeout + rotation
- No weak password policies

## A08: Software & Data Integrity

- Verify checksums for external resources
- Use Subresource Integrity (SRI) for CDN scripts
- Sign CI/CD artifacts

## A09: Logging & Monitoring

- Log auth events (login, logout, password change)
- Never log credentials or PII
- Set up alerts for anomaly patterns

## A10: SSRF

- Validate and sanitize user-supplied URLs
- Use allowlists for outbound requests
- Disable HTTP redirect following for untrusted URLs
