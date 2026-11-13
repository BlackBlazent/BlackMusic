# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 3.0.x (when released) and the latest 2.2.x | Yes |
| Older | No — please update |

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.
Use GitHub's private report form: <https://github.com/BlackBlazent/BlackMusic/security/advisories/new>
(the maintainer must have *Private vulnerability reporting* switched on in the repository's Security settings; if the form is unavailable, open a public issue that says only "I have a security report — how can I send it privately?" without any details).

Please include the version, your operating system, what you did, and what happened. You will get an acknowledgement as soon as the maintainer can reply; there is no guaranteed response time.

## Secrets

The app is a client program: anything compiled into it can be read by users. **Never** put a service's client *secret* or a service-role key in `VITE_` variables or in the app. See "Environment variables" in [DEVELOPMENT.md](DEVELOPMENT.md).
