# Test specs

Plan files for the `playwright-cli` plan → generate → heal workflow
(`.claude/skills/playwright-cli/references/test-generation.md`). One file per feature:
`.playwright/specs/<feature>.plan.md`.

Note: the vendored skill doc says `specs/<feature>.plan.md` (its generic default) — this project
keeps plans under `.playwright/specs/` instead, alongside the CLI's own config and output (all three
consolidated into one `.playwright/` folder: `cli.config.json`, `output/`, `specs/`). Unlike `output/`
(snapshots, screenshots — scratch, gitignored), `specs/` is checked into git; see the `.gitignore`
negation rule.

Each plan enumerates test scenarios in the format that skill's generate step expects — application
overview, then numbered scenario groups with a `**Seed:**` file reference and `- expect:` bullets per
step. Generated tests land under `tests/<group>/<scenario>.spec.ts`, one file per scenario, importing
from `tests/fixtures.ts`.

No plans exist yet — prod-agent has no implemented app to plan against (see root `CLAUDE.md`). Write
the first one once Phase 1 ships something with a UI.
