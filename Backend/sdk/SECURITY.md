# Security Policy

## Supported Versions

We actively support and maintain security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Security Audit Checks

This SDK includes automated security vulnerability scanning using npm audit. The security check behavior varies depending on the context:

### Postinstall Hook (Warning Mode)

The `postinstall` hook runs a security check that **warns but does not fail** on high-severity vulnerabilities. This is intentional for the following reasons:

1. **CI/CD Compatibility**: Some CI pipelines and automated deployment systems may fail if postinstall hooks fail, preventing successful installations even when vulnerabilities are non-critical or false positives.

2. **Non-Blocking Installation**: Users installing the SDK should not be blocked by security warnings that may not affect their specific use case. The warnings are clearly displayed to inform users without disrupting their workflow.

3. **Explicit Manual Checks Available**: Developers can run stricter security checks manually using:
   - `npm run security:check` - Fails on high-severity issues
   - `npm run test:security` - Fails on moderate+ severity issues
   - `npm audit` - Full audit report

4. **Publishing Protection**: The `prepublishOnly` hook runs strict security checks (`test:security`) before publishing to npm, ensuring vulnerabilities are addressed before release.

### Security Scripts

The SDK provides multiple security-related scripts with different behaviors:

- **`npm run security:warning`**: Runs audit and prints warnings for high-severity issues but does not fail (used by postinstall)
- **`npm run security:check`**: Runs audit and **fails** on high-severity vulnerabilities
- **`npm run test:security`**: Runs audit and **fails** on moderate+ severity vulnerabilities (used by prepublishOnly)
- **`npm audit`**: Standard npm audit with full reporting
- **`npm run audit:fix`**: Attempts automatic fixes for vulnerabilities

### CI/CD Integration

In CI/CD pipelines, security checks are run but configured to warn rather than fail to prevent blocking builds unnecessarily. However, you can modify the CI workflow to use stricter checks if needed:

```yaml
# Example: Fail on high-severity issues in CI
- name: Run security audit
  run: npm run security:check  # This will fail the build on high-severity issues
```

### Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email security concerns to: dev@celo-ai.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

We will respond to security reports within 48 hours and work to resolve critical issues promptly.

### Security Best Practices

When using this SDK:

1. **Regular Updates**: Keep dependencies up to date with `npm update`
2. **Security Audits**: Run `npm run security:check` regularly in your CI/CD pipeline
3. **Review Warnings**: Pay attention to postinstall security warnings
4. **Environment Variables**: Never commit API keys or private keys to version control
5. **Data Masking**: Use the built-in data masking utilities for logging sensitive information
6. **Production Checks**: Run `npm run audit:production` to check only production dependencies

### Dependency Security

This SDK depends on several external packages. We:

- Regularly audit dependencies for vulnerabilities
- Update dependencies promptly when security patches are available
- Use `prepublishOnly` hook to ensure no high-severity vulnerabilities are published
- Document security-related dependencies in package.json

### Automated Security Checks

The following automated checks are in place:

1. **Pre-publish**: `prepublishOnly` runs `test:security` to check for moderate+ severity issues
2. **Post-install**: `postinstall` runs `security:warning` to inform users of high-severity issues
3. **CI/CD**: GitHub Actions workflows include security audit steps

For more information about npm security advisories, visit: https://github.com/advisories

