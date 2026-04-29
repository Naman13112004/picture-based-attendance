# Security Policy

## Supported Versions

Currently, the `main` branch is the only supported version for security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

Security is a critical aspect of this project, particularly because it processes **biometric data (facial encodings)**.

If you discover any security vulnerabilities, data leaks, or unauthorized access vectors, please **DO NOT** report them publicly on GitHub Issues. 

Instead, please responsibly disclose them by emailing the maintainers directly or utilizing GitHub's private vulnerability reporting feature.

### Responsible Disclosure Process
1. Report the vulnerability privately.
2. The team will acknowledge receipt of your vulnerability report within 48 hours.
3. We will provide an estimated timeline for the fix.
4. Once the issue is resolved and deployed, you will be credited in our release notes if desired.

## Biometric Data & Privacy Practices (GDPR / CCPA)

As an open-source face recognition project, we strictly enforce data minimization and privacy-by-design:

- **Secure Storage**: Facial encodings and reference images should ideally be stored in secure, private buckets (e.g., Supabase Storage with strict RLS policies). 
- **Data Anonymization**: Encodings should not be tied to PII (Personally Identifiable Information) in a way that allows reverse-engineering a user's identity without proper database authorization.
- **Consent Handling**: Implementers of this system MUST ensure they have explicit consent from students/employees before capturing and storing their biometric data.
- **Data Deletion**: The system should support hard deletion of encodings and references when a user requests their data be removed (Right to be Forgotten).

We encourage contributors to audit the codebase for potential leaks of `image_paths` or `encodings` in logs or error messages.
