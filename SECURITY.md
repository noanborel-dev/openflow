# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in Yappr, please
report it by email to **security@yappr.app**. Encrypt sensitive details
with our PGP key (link to be published before 2026-09-11).

Please include:

- A description of the issue and its impact
- Steps to reproduce
- The version of Yappr you are testing (visible in Settings → About)
- Your platform (macOS or Windows) and OS version
- Any proof-of-concept code, screenshots, or logs

We commit to:

- Acknowledging your report within **3 business days**
- Providing an initial assessment within **10 business days**
- Releasing a fix or detailed plan within **90 days** of the report,
  coordinated with you on public disclosure timing

## Scope

In scope:

- The Yappr desktop application (macOS and Windows builds distributed
  from yappr.app)
- The Yappr landing site at yappr.app and its supporting endpoints
- The bundled third-party components when used in their integration with
  Yappr (vulnerabilities in upstream projects should also be reported
  to those projects directly)

Out of scope:

- Third-party AI providers (Groq, OpenAI, Anthropic) — please report to
  those vendors directly
- The end user's chosen API key handling outside Yappr's process
  boundary
- Social-engineering attacks against Yappr operators

## Safe harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to comply with this policy
- Do not access or modify user data beyond what is strictly necessary to
  demonstrate a vulnerability
- Do not publicly disclose the vulnerability before we have had the
  opportunity to remediate it
- Do not perform denial-of-service testing against production services

## Support window

Security updates are issued for the **latest minor version** of Yappr.
Users on older versions are expected to upgrade to receive fixes.

## Regulatory note

This policy is the intake side of Yappr's compliance with the EU Cyber
Resilience Act's vulnerability handling obligations (Article 14, effective
2026-09-11). The corresponding incident-response runbook covering the
24-hour / 72-hour / 14-day ENISA reporting timer is maintained internally.
