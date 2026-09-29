# Security Policy — Orbitscar

## Project status: proprietary, not open source

Project Orbitscar is proprietary software. The source is published for source visibility and transparency only. The repository [LICENSE](LICENSE) is a proprietary license notice that grants no permission to copy, modify, redistribute, or build derivative works. The [README](README.md) states this in its opening banner.

Because no permission to use the code has been granted, a defect in it is not a "vulnerability" in the open-source sense. It is a question about unauthorized use of unlicensed software, and that question belongs to the owner of the code, not to a public disclosure process. This file exists so the boundary is stated plainly instead of left to inference.

## What this repository does not offer

- **No security support.** The maintainer does not triage, investigate, or remediate security reports for Orbitscar.
- **No coordinated disclosure program.** There is no embargo, no safe harbor, and no private disclosure window.
- **No bug bounty.** No reward is offered.
- **No response-time commitment.** There is no SLA and no support window.
- **No supported versions.** No release is a supported security-fix channel.

## Documented integrity controls

Orbitscar is the one project in this family with an explicit written threat model, and it should be read as a design intention rather than a verified control.

- [docs/security/game-threat-model.md](docs/security/game-threat-model.md) — assumes modified APKs, browser tampering, scripted clients, replayed requests, clock spoofing, and colluding accounts. It records security invariants such as never accepting client-declared inventory, victory, rank, loot, or time completion, and requires every mutation to be authorized against current server state with an idempotency key.
- [fixtures/](fixtures/) and the [docs/testing/](docs/testing/) material — reproducible battle inputs and the verification approach that the threat model depends on.

## An important caveat

Most of the threat model's controls — server authority, append-only ledgers, signed report hashes, anti-replay keys, role policies, rate limits — describe a **persistent backend that does not exist yet**. The [README](README.md) states that live operations, monetization, and a persistent backend are deliberately deferred; the current gate is a local colony-to-breach loop.

The controls are therefore a specification for future work, not protections currently in force. Do not read this document as evidence that the shipped build resists a determined attacker; there is no authoritative server to trust.

## Reporting a genuine concern

If you believe you have found a genuine security concern, the honest position is that the maintainer has not accepted a support obligation, so there is no guaranteed response. If you choose to raise it anyway:

- Prefer GitHub's private vulnerability reporting for this repository (the **Security** tab → **Report a vulnerability**), if it is available to you.
- Otherwise contact the repository owner through their public profile at <https://github.com/gthgomez>.
- Do not open a public issue, and do not include working exploit code or third-party personal data in a public report.
- You receive no service commitment, no bounty, and no assurance of a fix.

## Visibility is not permission

The repository being public creates no support obligation. Publishing source does not grant a license, does not create a support contract, and does not make the maintainer a vendor to you. Opening an issue or submitting a pull request grants you no rights and creates no partnership; contributions are not accepted for reuse, and no license is granted over anything you send here.
