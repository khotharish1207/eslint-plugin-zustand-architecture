# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Reporting a Vulnerability

If you discover a security vulnerability in `eslint-plugin-zustand-architecture`, please report it responsibly.

### How to Report

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Contact the maintainers directly through the repository security advisories tab
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Affected versions
   - Possible impact
   - Suggested fix (if any)

### Response Timeline

- We will acknowledge receipt within 72 hours
- We will provide an initial assessment within 7 days
- We will work on a fix and coordinate disclosure

## Security Best Practices for Users

- Pin the plugin version in your `package.json`
- Review dependency updates before applying
- Use `npm audit` or equivalent tools to scan for vulnerabilities

## Scope

This plugin performs static analysis on ESLint source code. It does not:
- Execute user code
- Access network resources
- Modify files on disk (no autofixes)
- Collect or transmit telemetry

## License

MIT