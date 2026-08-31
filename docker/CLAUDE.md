# Docker

Everything that builds or runs Custodian as a container. Loads on top of the root `CLAUDE.md` when
Claude reads a file in this directory.

```
docker/
  Dockerfile                 the runtime image
  Dockerfile.dockerignore    the build context; BuildKit prefers this over a root .dockerignore
  compose.yaml               the agent, and a dev-only Vault behind a profile
```

## Running it

```bash
docker compose -f docker/compose.yaml up agent                  # against a Vault you operate
docker compose -f docker/compose.yaml --profile dev up          # throwaway local Vault
docker build -f docker/Dockerfile -t custodian .                # image only
```

**The build context is the repository root**, not this folder, because the image copies `src/`. That
is why `compose.yaml` sets `context: ..` and `dockerfile: docker/Dockerfile`, and why every `docker
build` invocation ends in `.` rather than `docker/`. A `build: .` here resolves to `docker/` and
fails on the first `COPY` — `tests/docker.test.ts` refuses that shape.

## Four decisions that look wrong until you know why

**No `node_modules`, and no dependency stage.** Bun's own guide splits dev and production installs,
which is right for a runtime with third-party dependencies. This one has none: `dependencies` in
`package.json` is empty, every third-party package is a devDependency the gates use, and the only
non-relative imports under `src/` are `bun:sqlite` and `node:crypto`. Installing here would ship a
toolchain the process never loads.

**`tsconfig.json` ships, and is load-bearing at runtime.** Its `paths` maps `@custodian/*` onto
`src/*/index.ts`, and Bun resolves those at import time. Without it the process cannot find a single
component. It used to copy `tsconfig.base.json` too; that file was merged away and the `COPY`
naming it survived one commit, breaking the build while `bun run verify` stayed green.

**The gates do not run in the build.** `bun run verify` needs `tests/` and `scripts/`, which the
ignore file keeps out of the context deliberately, and CI runs the identical command on every push.
A second copy of a gate inside the image is a second thing to keep in step.

**The dev Vault is behind a profile and is not the default.** It runs in dev mode, which keeps
storage in memory: every restart destroys every key-encryption key, and every sealed row on the
agent's volume becomes permanently unreadable. Durable ciphertext with ephemeral keys is precisely
the defect `custodyDecision` refuses to boot into. The production composition expects a Vault you
operate.

## Single instance, deliberately

The stores are SQLite files on one named volume. A second replica gets its own idempotency ledger
and stops deduplicating redeliveries — the double execution that ledger exists to prevent. Scaling
out means moving those stores to a shared engine first, not raising the replica count.

The volume is named rather than a bind mount for a related reason: sealed rows must survive a
redeploy, and the dev composition uses a *separate* volume because rows sealed against a dev Vault
are already unreadable and must never share storage with rows that are not.

## What CI does, and what it does not

| Check | Where | Blocking |
|---|---|---|
| Every `COPY` path exists; compose builds from the root; the ignore file still excludes the corpus, `.claude/`, `.env` and `*.sqlite` | `tests/docker.test.ts`, in `bun run verify` | **Yes** |
| The image builds, starts, reaches its boot gate, and ships none of the above | the `docker` job | No |

The split is LD-10's rule: a docker build pulls a base image over the network, and a network
dependency in a blocking position is worse than no gate, because one that fires at random teaches
people to click through red CI. So the text checks block and the real build does not — and the
defect that actually got through is caught by the half that always runs.

## Before changing anything here

- Renaming or deleting a file the `Dockerfile` copies is a change to this folder too. That is the
  blast-radius rule in `.claude/rules/change-discipline.md`, and it is the specific thing that broke.
- The base image is pinned to an exact Bun version on purpose. `:1` and `:latest` both move, and an
  artefact that shifts underneath a release is not the artefact that passed the gates.
- Anything added to the image must be checked against `Dockerfile.dockerignore` first. The corpus,
  `.claude/`, `.env`, and every `*.sqlite` are excluded because shipping them inside a published
  artefact is not recoverable by deleting the tag.
