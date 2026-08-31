# Locked Decisions

> **Deliberately unscoped.** These decisions cut across every layer — routing, durable execution,
> credentials, storage, retention, process, packaging — so no single glob represents "an
> architectural decision", and `CLAUDE.md` tells every reader to consult this before re-deciding
> anything. Scoping it would make that instruction conditional on which file happened to be open.

Architectural decisions the spec left open, resolved during implementation. Each was stress-tested
before being locked, and each records **what would reopen it** — a locked decision is not a
permanent one, it is one that costs a deliberate act to change rather than an accident.

**This file is tracked.** It was machine-local until 2026-08-30, because `.gitignore` excluded all
of `/.claude/` for a reason that applied to the settings and hooks in there and never applied to
this. The consequence was that the file `CLAUDE.md` tells every reader to consult first was the one
file a fresh clone could not get, and the decisions had to be re-derived from commit messages.
`.gitignore` now ignores `/.claude/*` and re-includes `rules/` and `agents/`; everything carrying an
absolute path stays local.

Adding an entry is therefore a commit, and worth writing as one — the reasoning here is the part
that does not survive in the code.

---

## LD-1 — Component 1 (the LLM gateway) is first-party

**Decided:** 2026-08-29, Stage 2. Stress-tested with `adversaria:devils-advocate`.

**The question the spec left open.** `AI_Agent_Implementation_Plan_v2.txt:106` frames build-versus-buy
as "a latency and operations question" and stops short of deciding.

**The case for buying, at its strongest.** The latency objection is dead — roughly 0.7 ms added p99
for the Rust path, against 257.7 ms for the legacy Python path, which is the outlier rather than the
category. Provider churn is continuous and a vendor absorbs it. Retries, budgets, rate limits and
streaming are solved products.

**Why it loses anyway.** Three locked constraints share one root: they all require Custodian to own
*which provider gets called next*.

| Constraint | What a bought gateway does instead |
|---|---|
| Residency must refuse when no in-region provider is eligible | Gateways model fallback as availability, not legality. Refusal is a business rule they have no vocabulary for |
| Every provider call in the F3 log with router decision and rationale | An internal retry the gateway does not surface is an unlogged provider call — a hole in the evidence record |
| The idempotency claim persists before any call, including failover | If the gateway owns failover, the retry happens in a process that never saw the claim |

There is a clean mitigation — run the gateway with a single provider and retries and fallback
switched off — but it dissolves the reason to buy. Every feature justifying the purchase is one you
must disable to stay compliant, and what remains is provider SDK normalisation, which is what an
adapter behind the `ModelProvider` port already is.

**What is locked.** The decision layer — routing, residency, retries, budgets, rate limits — is
first-party. A vendor SDK is welcome *below* the `ModelProvider` port as a per-provider adapter,
never in front of it. `ModelProvider` deliberately has no fallback method.

**What would reopen it.** A gateway that exposes fallback as a policy hook the caller owns, surfaces
every internal attempt as a distinct observable event, and lets a refusal terminate the chain. None
did as of August 2026.

---

## LD-2 — Layering is enforced by `dependency-cruiser` alone

**Decided:** 2026-08-29, Stage 0.

`Engineering_Standards.txt:133` offers `eslint-plugin-boundaries` *or* `dependency-cruiser`. The
plugin was tried first and removed: under v7, element patterns match folders rather than files, and
every cross-layer import in this layout resolved as `unknown`, so the rule passed a planted
`domain → infrastructure` violation.

**What is locked.** `.dependency-cruiser.cjs` owns the layer graph, and every rule in it has been
verified to reject a planted violation. A gate that never fires is worse than no gate — it is false
assurance, which is the failure mode this entire spec warns about.

**What would reopen it.** A boundaries release whose classification works against this layout,
demonstrated by planting a violation and watching it fail. Editor-time feedback is worth having; it
is not worth a rule that silently passes.

---

## LD-3 — Tests live under `tests/`, mirrored by package

**Decided:** 2026-08-29, Stage 1. Direct user instruction, overriding
`Engineering_Standards.txt:149` which specifies siblings.

`tests/<package>/<unit>.test.ts`, importing `@custodian/<package>` rather than reaching into `src/`.
The package must appear in the root `package.json` `devDependencies` as `workspace:*`.

**Consequence worth knowing.** Tests exercise the public barrel, so an internal helper that is not
exported cannot be unit-tested directly. That is a feature — it keeps the tested surface and the
supported surface identical — but it means a genuinely internal algorithm needs either an export
with a documented reason or a test through its caller.

---

## LD-4 — Every acceptance gate must be proven able to fail

**Decided:** 2026-08-29, Stage 1. Applies to every stage from here.

A gate that cannot fail is not evidence. Before an acceptance test is trusted, the property it
guards is temporarily broken and the test must fail.

Proven so far:

| Gate | Violation planted | Result |
|---|---|---|
| Erasure acceptance | Skip `destroySubjectKey` | Fails |
| Residency refusal | Delete the two region checks in `isEligible` | 5 of 7 routing tests fail |
| Serving-core chaos | Same | Out-of-region provider gets called |
| Tenant isolation | Export a `namespaceFromString` escape hatch | Fails |
| Constraint pinning | Treat pins as ordinary messages | 2 compaction tests fail |
| Toolchain gates | `any`, `enum`, default export, `as`, `domain → node:fs`, prohibited folder name | Each fails its own rule |

This is not ceremony. `Test_and_Security_Assurance.txt:86` makes the same point about red teams: a
report with zero findings means the test was too weak.

---

## LD-5 — TypeScript is pinned to 6.0.3, not 7.x

**Decided:** 2026-08-29, Stage 0.

TypeScript 7's `tsc` is at parity for program creation, checking and emit, but the compiler **API**
is marked `not ready` in the port's own readiness table. `typescript-eslint` consumes that API for
typed linting, so migrating now trades mechanical enforcement of the banned-construct table for
compile speed.

**What would reopen it.** The API row flipping to `done`, plus a `typescript-eslint` release that
supports it. Re-check at the start of each stage; the pin is a cost, not a preference.

---

## LD-6 — Component 9 (durable execution) is bought, under three conditions

**Decided:** 2026-08-29, Stage 4. Stress-tested with `adversaria:devils-advocate`.

**Why the answer differs from LD-1.** The gateway had to be first-party because buying surrendered a
compliance-critical decision — which provider gets called next. A durable execution engine decides
*when to retry a step*. It does not decide which provider, which tenant, or whether a residency
boundary may be crossed. Nothing compliance-critical is surrendered, and
`AI_Agent_Implementation_Plan_v2.txt:194` is explicit that the common outcome of building is that
teams write half a durable execution engine themselves.

**The four counters, and what happened to them.**

| Counter | Resolution |
|---|---|
| Workflow payloads carry prompts and tool arguments — personal data whose storage location the vendor answers, not us | **Mitigated by design:** payloads carry `SealedContent` references, never plaintext |
| Crypto-shred must reach every location holding personal data, and engine history is not ours to key-destroy | **Same mitigation:** the engine holds ciphertext only, so destroying the subject key reaches it |
| Long-running executions outlive deployments; changed workflow code must replay old state safely | **A procurement gate, not a disqualifier.** Building makes version skew harder, not easier. The spec names this as the criterion teams routinely miss |
| G20: an abstraction layer is not an exit plan | **A requirement on the purchase.** It applies to model providers too; the rehearsal is the deliverable either way |

The argument graph returned "does not survive" on a mechanical count of undermining edges. That
count is not the reasoning — two of the four are mitigated and two are conditions, which is a
materially different shape from LD-1, where the constraints were structurally incompatible with
buying.

**What is locked.**

1. **The engine never holds plaintext.** Workflow payloads carry `SealedContent`. This is what keeps
   the engine's storage location a small residency question and keeps crypto-shred reaching it.
2. **Version-skew replay is a selection gate**, tested against a candidate before procurement, not
   discovered afterwards.
3. **The provider switch is rehearsed on a schedule.**

First-party regardless: the `WorkflowEngine` port, and the erasure workflow as a pure state machine.
The erasure logic is ours and testable without an engine; only its execution is bought.

**What would reopen it.** A residency or erasure obligation that reaches inside engine-managed state
in a way sealing does not cover, or a candidate failing the version-skew gate with no alternative.

---

## LD-7 — Credential controls are chosen per boundary shape, not copied between boundaries

**Decided:** 2026-08-29, post-Stage 4, from an audit of `tenant-claim.ts`.

**The finding.** The platform had its controls inverted. The **agent card** — an agent proving
identity for a handoff — carried three controls: signature, freshness window, and a nonce replay
ledger. The **tenant claim** — the token deciding whose data a query may read, and the boundary
whose breach `Reliability_and_Operations.txt:84-86` says pages and is treated as a breach until
disproven — carried one: a signature. No expiry, no replay defence. A captured tenant token was
valid forever.

**Why the fix is not "copy the card's controls."** The two credentials have different shapes:

| | Agent card | Tenant claim |
|---|---|---|
| Presented | Once per handoff | On every query, by design |
| Nonce ledger | Correct — a second use is an attack | **Wrong** — it would reject legitimate reuse |
| Short window | Free | Unusable; a 5-minute session token is not a session |
| Right control | Nonce + 5-minute window | **Bounded lifetime** |

Copying the card's controls would have broken normal operation. Copying none of them left the
higher-stakes boundary unguarded. The control has to follow the credential's shape.

**What is locked.** A tenant claim is rejected unless it is signed, currently within its validity
window, not issued in the future, **and** its total lifetime is at most one hour
(`MAX_CLAIM_LIFETIME_MS`).

The lifetime bound is the non-obvious half. Checking `expiresAt` alone is not enough: an issuer that
can set expiry arbitrarily far out defeats the control, because a token minted with a ten-year
lifetime passes an expiry check and is functionally the unexpiring token the check exists to
prevent. Bound the lifetime, not just the deadline.

**Standing rule.** When adding any credential boundary, state which of signature / validity window /
lifetime bound / replay ledger applies **and why the others do not**. A boundary with fewer controls
than a lower-stakes neighbour is a defect until justified.

**What would reopen it.** A session model where one hour is operationally impossible — in which case
the answer is refresh tokens, not a longer cap.

---

## LD-8 — No store holds plaintext content, and no key is content

**Decided:** 2026-08-29, from a boundary audit prompted by LD-7.

**How this was found.** LD-7 came from comparing two credential boundaries side by side. Applying
the same method to storage boundaries — listing every `readonly ... : string` that holds model
content, then checking each against `DATA_MAP` — surfaced three defects that no single-file review
would catch.

| Defect | Why it mattered |
|---|---|
| `RecordedOutcome.body` held the completion in plaintext, and the idempotency store was **not in the data map** | By the spec's own rule, any location not in the map is a defect. Erasure could not reach it |
| `ResponseCache` values were plaintext | The data map requires "key destruction + targeted invalidation by subject tag"; the cache could only invalidate per tenant |
| **The cache key *was* the prompt in plaintext** | Destroying the value still left the question readable in the index. Erasing the answer while the key says what was asked is not erasure |

**What is locked.**

1. **Any store that persists model content holds `SealedContent`, never `string`.** This is the same
   rule LD-6 applied to workflow payloads, generalised. One key destruction then reaches every
   store by construction, rather than each store needing a per-subject index.
2. **Cache and index keys are digests, never content.** A key derived from a prompt leaks the prompt.
3. **A new store that persists content must be added to `DATA_MAP` in the same change.** The erasure
   workflow's data-map check reports a missing location as a defect, so the gate catches an
   omission — but only for locations the map knows to expect.

**Also fixed alongside.** Idempotency claims had no TTL, which was two bugs at once: unbounded
growth, and a legitimately identical request months later silently deduplicated and never executed —
returning a stale answer for work that never ran. Claims now expire after 24 hours.

**Standing rule.** When adding a store, answer three questions in the PR: does it persist model
content, is it in the data map, and is its key a digest? A "no" to any of the three is a defect
until justified.

---

## LD-9 — The retention schedule is data in one package, not numbers in seven

**Decided:** 2026-08-29, third pass of the boundary-audit method.

**How this was found.** Same method as LD-7 and LD-8: enumerate a category of boundary and diff the
members. Here the category was retention, and the diff was against the seven-row table in
`Data_Protection_and_Retention.txt:114-140`.

**What the audit found.** The spec defines seven retention classes. The code had four scattered
magic numbers referencing nothing, and **three classes encoded nowhere**:

| Class | Before |
|---|---|
| Prompts and completions (30 days) | **The response cache had no TTL at all** — cached completions lived forever |
| Execution log metadata (24 months) | No mechanism |
| Backups (35 days) | Not encoded |
| Billing records (7 years) | Not encoded |
| Agent memory (12 months) | `MEMORY_RETENTION_DAYS = 365` — correct by coincidence, referencing nothing |

Sealing (LD-8) made the cache *erasable on request*. It did nothing about disposal *on schedule*.
Those are different obligations and satisfying one is not evidence of the other.

**What is locked.**

1. **`@custodian/retention` holds the schedule as data**, exhaustive over a `RetentionClass` union,
   with `expiresAt` and `isDueForDisposal` as the only ways to compute a period.
2. **A test transcribes the spec table and asserts the schedule matches it row for row.** A
   retention period is a legal position, not a tuning parameter, so drift fails the build. Shortening
   execution-log metadata from 730 to 90 days fails that test.
3. **Stores derive their period from the schedule** rather than declaring their own.
4. **An expired cache entry is dropped on read**, so an unswept cache cannot serve stale content
   while waiting for a sweeper that may not run.

**Standing rule, now covering three passes.** When adding anything to a category that already has
members — a credential, a store, a retained class — diff it against its peers before merging.
All three defects found this way were invisible in the file that contained them and obvious the
moment two peers sat side by side.

**Still not encoded, and deliberately so.** Billing records and backups have periods in the schedule
but no store in this repo yet. They are in the table so that when those stores land, the period is
already decided rather than invented at the point of writing the store.

---

## LD-10 — Process failures become tests, not reminders

**Decided:** 2026-08-30, after merging the stage stack.

Three failures surfaced during the merge. Each was invisible in the file that contained it and only
appeared when something downstream broke. Each is now a test in `tests/standards.test.ts`, which was
already the file guarding config from silent drift.

| Failure | Guard |
|---|---|
| CI filtered on `pull_request: branches: [main]`, so four stacked PRs had **no checks at all** and looked mergeable while never having run | The workflow's `pull_request:` trigger must carry no branch filter |
| `webview.test.ts` navigated a browser to `example.com`, failing on a runner | No test file may contain an `http(s)://` URL |
| A Dependabot `ignore` for TypeScript was filed under `github-actions` rather than `bun`, where it parsed fine and did nothing | The `bun` ecosystem block must contain the TypeScript 7.x ignore |

All three proven non-vacuous: restoring the branch filter, planting a network URL in a test, and
moving the ignore to the wrong ecosystem each fail their own guard and only their own.

**The general form.** A flaky gate is worse than a missing one. A gate that never fires is false
assurance (LD-2); a gate that fires at random trains people to click through red CI, which costs the
credibility of every gate beside it. Neither belongs in a blocking position.

**What could not become a test.** Stacked-PR merge order is a `gh` behaviour, not a repo invariant —
`gh pr merge --delete-branch` closes a child PR rather than retargeting it, and a closed PR whose
base is gone cannot be reopened. That is recorded in `.claude/rules/pull-requests.md` instead,
along with the ordering that works.

**Permissions.** `.claude/settings.json` had `WebFetch` in both `allow` and `deny` — deny wins, so
the allow entry was decoration. `git push` no longer prompts; force-push to a shared branch and repo
deletion are denied outright; `gh pr merge`, `git reset --hard` and `git clean` ask, because they
discard work rather than create it.

**The web denies route web access; they do not block it.** `WebFetch` and `WebSearch` are denied
because the intended path for fetching and searching is the **`bun-webview` skill** — `Bun.WebView`
driving a real browser, which renders JavaScript, takes screenshots and simulates input, none of
which the built-in tools do. `curl` and `wget` are denied for the same reason: one way to reach the
web, not three.

This is a routing preference, not a security boundary, and it must not be recorded as one.
`Bash(bun *)` is allowed, so the network is one line away regardless:

```
$ bun -e 'const r = await fetch("https://example.com/"); console.log(r.status)'
200
```

That is fine — it is the same allowance `bun-webview` needs. A real boundary would be
`sandbox.network.allowedDomains` with `strictAllowlist: true`, which enforces per-runtime rather
than per-tool. Deliberately not enabled: it would break `bun install` and `gh` until the domain list
was tuned, and the goal here is tool choice, not containment.

## LD-11 — A gate is not enforcing until a violation of *the shape it guards* has failed it

Planting a value import proved the layering rule fired. It did not prove the rule saw the imports
this codebase actually writes: under `verbatimModuleSyntax`, most cross-package imports in `domain`
are `import type`, and dependency-cruiser cruises transpiled output by default, where those are
already erased. The gate reported clean over 201 dependencies while 141 were invisible to it. Three
real violations — `response-cache/domain` → `knowledge-base`, `gateway/domain` → `routing` (twice) —
were sitting in `main` the whole time.

Same failure in the ESLint assertion exemption: a 16-entry path allowlist stopped exempting six
files the instant they moved a folder deeper. It failed loudly in that direction, but nothing would
have caught the reverse.

**Rule:** when planting a violation to prove a gate, plant the *idiomatic* form, not the convenient
one. If the codebase writes `import type`, the plant is an `import type`. Guard the config line the
gate depends on with a test, since removing it restores silence rather than an error.

Consequences taken: `tsPreCompilationDeps: true`; `ProviderId` and `Namespace` moved to
`domain-primitives`; every brand now built through a single `brand()` constructor, collapsing the
assertion exemption from sixteen paths to one file; both invariants pinned in
`tests/standards.test.ts`.


---

## LD-12 — A plant pass starts from a clean tree

**Decided:** 2026-08-30, after losing two fixes to a plant restore.

LD-4 requires every gate be proven able to fail, so plant passes are routine. Restoring a plant with
`git checkout <file>` is the obvious move and it is unsafe: checkout reverts to HEAD, taking any
uncommitted work in that file with the plant. It happened — a dev-mode boot gate and a retention
sweep, written minutes earlier, vanished during a restore. Nothing failed, because reverting to a
green HEAD leaves a green tree. The loss was found only because a later manual check ran the server
and saw it boot when it should have refused.

**What is locked.** A plant pass begins from a clean tree, enforced by `scripts/plant-guard.ts` and
proven by `tests/plant-guard.test.ts`. With a clean tree, `git checkout` can only undo the plant,
because the plant is the only change. Copying files to `/tmp` and restoring from there also works
and is what several passes in this repo already do — but it fails silently when a later `git
checkout` in the same pass touches the same file, which is exactly how the loss occurred.

**The general form, and why it is LD-10's shape again.** The failure was invisible in the artefact:
green tests, clean diff, missing work. A reminder would not have caught it, because the person
holding the reminder is the one who just reverted the file. The guard is mechanical.

**What would reopen it.** A restore mechanism that cannot touch uncommitted work at all — a worktree
per plant, say — would make the clean-tree requirement unnecessary rather than merely enforced.

---

## LD-13 — Vault Transit holds the KEKs, and `external` attestation means a confirmed absence

**Decided:** 2026-08-30, by the repo owner, from a four-way comparison. Unblocks the durable subject
key store and per-subject erasure of vector-index embeddings.

**The question the spec left open.** `Data_Protection_and_Retention.txt:74` fixes the *shape* — a
per-subject DEK wrapped by a KEK in the KMS, with the KMS destruction record as the audit artefact —
and names no product.

**Why Transit, on one property.** Its delete is immediate.

| Candidate | Destroy latency | Consequence for the release gate |
|---|---|---|
| **Vault Transit** | Immediate | Passes `:110-112` as written |
| AWS KMS | 7–30 days, cancellable throughout | The key is recoverable *by design* for a week |
| GCP Cloud KMS | 24h floor, restorable until then | Same shape, one day |
| Azure Managed HSM | Immediate *only if purge protection is off* | Erasure and SOC 2 pull against one switch |

The release gate is "erase, then attempt recovery from raw storage, every cache, and a pre-request
backup; any recovered fragment fails". AWS and GCP would each have forced that into an assertion
about a *scheduled intent* rather than about irrecoverability — a materially weaker gate, adopted to
suit a vendor rather than the obligation.

**Explicitly rejected: an env-var KEK.** Run through `adversaria:devils-advocate`, returned "does not
survive" on four undermining edges. The root objection: it lets the operator forge the proof the
erasure gate checks, which makes the gate theatre.

**What `attestation: "external"` actually claims.** Not "Vault issued this record" — Transit's DELETE
answers 204 with no body, and its audit-device entry is not readable from the application. The claim
is narrower and true: *the key is absent from a store this process does not control, and any third
party with read access can confirm that independently.*

That is why the confirmation read is not optional. `destroyKey` sends DELETE, then GET, and returns a
proof **only** if the GET returns 404; otherwise `destruction-unconfirmed`, which is a failure rather
than a proof. A DELETE answering 204 while the key survives — a partitioned standby, a policy
granting delete but not read, a lying proxy — would otherwise leave the platform signing a record of
a destruction it never witnessed. This is LD-7's shape again: the control has to match what the
credential actually establishes.

**Consequences taken.**

1. `AesGcmSubjectKeyStore` is **deleted**, not kept as a test double. Attestation belongs on the
   component that destroys the key, so `InMemoryKeyCustodian` self-attests and the Vault one attests
   externally. Keeping both stores would have been two implementations of one concept
   (`change-discipline.md`), and the deleted one's defining property — holding its own keys — is the
   exact defect being fixed. `tests/standards.test.ts` fails on any `SubjectKeyStore` implementation
   with no `KeyCustodian` behind it, because reintroducing that shape looks like a helpful test
   double right up to the moment it is composed in `main.ts`.
2. **The deletion registry is durable and first-party.** The KMS cannot make erasure idempotent:
   after the key is destroyed there is nothing there to return the original proof with (`:95-96`).
   Held in process, a restart would mint a fresh proof — truthful about the outcome, wrong about
   when, and a second audit record of one destruction. `INSERT OR IGNORE`, never `REPLACE`: the first
   proof is the true one.
3. **A half-configured Vault refuses to boot, even with `CUSTODIAN_DEV_MODE=1` set.** This is the
   dangerous case and the reason `custodyDecision` is a pure function rather than a chain of `??`.
   Falling back to in-process keys when the token is a typo means the service boots green, serves
   traffic, writes sealed rows to disk, and silently stops being erasable — with nothing observing it
   until an erasure request arrives against keys a restart already destroyed.
4. **Embeddings are sealed.** The data map gives the vector index one mechanism — "Key destruction —
   soft delete is insufficient" (`:49-50`) — and inversion attacks make a bare vector a recoverable
   fragment rather than a harmless derivative. An entry whose key is gone is dropped on read,
   mirroring LD-9's cache. The cost is one unwrap per candidate per query, which is why the namespace
   filter stays ahead of it.

**Now verified.** `scripts/verify-vault-custody.ts` was run on 2026-08-30 against
`hashicorp/vault:latest` in dev mode, and all nine checks passed: seal, unseal round-trip, the
wrapped key carrying Vault's own `vault:v1:` prefix, destruction, an externally attested proof, the
ciphertext being unrecoverable afterwards, and a repeat erasure returning the original proof.

Probing the real server also settled three status codes the adapter had only guessed at, and one of
them was load-bearing: a **bad token answers 403**, an **unknown key answers 400**
("encryption key not found"), and **bad ciphertext answers 400** ("invalid ciphertext length"). The
adapter originally treated every non-200 as a destroyed key, so a 403 from a rotated policy read as
"this person has been erased" — and callers delete what they cannot unseal. That bug was found by
review before this probe; the probe is what confirms the fix matches Transit rather than matching an
assumption about Transit.

The 204-with-no-body claim below is confirmed: a DELETE carries no body and no `X-Vault-Request-Id`
header, so there is genuinely no Vault-issued record to put in the proof, and `external` still rests
on the confirmation read exactly as described.

**What would reopen it.** A Transit release exposing the audit entry to the caller, which would let
the proof carry a genuinely Vault-issued record id and make `external` a stronger claim than a
confirmed absence. Or an AWS/GCP change offering immediate, non-cancellable destruction.

**Still open, deliberately deferred.** Key *rotation* (`Gap_Register_v2.txt:269-273`). Transit's
`rotate` + `rewrap` is the mechanism, and the tenant claim's missing `kid` is the same gap from the
other side — both belong in one rotation change.

---

## LD-14 — The package split is enforced by one test, not by module resolution

**Found:** 2026-08-30, when the 27-package layout was questioned and the claimed benefit turned out
not to exist.

**The claim that was wrong.** That splitting the platform into 27 workspace packages buys
enforcement at *module resolution* — that `routing` cannot import `gateway` because it is not in
`routing`'s dependencies, which would be a harder guarantee than a lint rule. It is not true.

**What the plant showed.** `gateway/src/infrastructure` importing `@custodian/oversight`, a package
absent from gateway's manifest:

| Gate | Verdict |
|---|---|
| `tsc --noEmit` | passes |
| `dependency-cruiser` | passes — 237 modules, 644 dependencies, no violations |
| `knip` | passes |
| ESLint | passes, 0 errors |
| Bun at runtime | resolves and executes |

**Why isolated linking does not prevent it.** `bunfig.toml` sets `linker = "isolated"` for exactly
this reason, and it works one level down: `packages/routing/node_modules/@custodian/` contains only
`domain-primitives`. But resolution walks *upward*, and the root `node_modules` holds all 27
packages — because LD-3 requires every package in the root `devDependencies` so `tests/` can import
them. The requirement that makes the test layout work defeats the isolation. The two decisions are
individually sound and jointly a hole.

**Why dependency-cruiser misses it.** It catches a `domain` phantom only because a *layering* rule
fires there by coincidence. Between any other two layers it sees nothing: a workspace import arrives
with `dependencyTypes: unknown`, which is the documented reason `.dependency-cruiser.cjs` uses
path-based rules in the first place. That comment recorded the landmine without anyone noticing it
also disarmed the phantom-dependency check.

**What is locked.** `tests/standards.test.ts` asserts that every `@custodian/*` import under
`packages/*/src` is declared in that package's own `package.json`. It found a real violation on its
first run — `retention` imported `domain-primitives` while declaring no dependencies at all — which
is the answer to whether it was worth writing.

**The consequence for the layout itself.** The 27-package split was justified to me on a benefit it
did not deliver. With this test it delivers it; without the test the packaging is documentation, and
27 manifests are an expensive way to write documentation. Anyone proposing to collapse the packages
should know that this test, not the packaging, is what holds the line — and that a single package
with folder-scoped rules could hold the same line for less.

**What would reopen it.** Bun growing a strict workspace-resolution mode that refuses an undeclared
workspace import at resolution time, or dependency-cruiser resolving workspace imports as something
other than `unknown`. Either would make this test redundant, and redundant is the right thing for it
to become.
