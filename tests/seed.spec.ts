import { test } from './fixtures'

// Entry point for the playwright-cli plan/generate/heal workflow
// (.claude/skills/playwright-cli/references/test-generation.md). `--debug=cli`
// pauses here before the fixture's goto('/') runs, so every planning/generation
// session starts from this file.
//
// baseURL in playwright.config.ts is a placeholder until an app exists to test
// (Custodian is pre-implementation per CLAUDE.md) — update it once Phase 1 ships,
// and this fixture's goto('/') will pick it up with no other changes.
test('seed', async ({ page }) => {
  void page // fixture already navigated; empty body tells agents where to start
})
