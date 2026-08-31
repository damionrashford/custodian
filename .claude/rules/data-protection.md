# Data Protection

> **Deliberately unscoped.** A `paths:` glob that missed a store would stop this loading for exactly
> the change that needed it, and the failure would be a compliance defect rather than a slow session.
> Forty-seven lines on every session is the right trade.

Position in one sentence: the platform encrypts personal data per data subject, erases by destroying the key, and can prove it did so. Full detail: `.research/Data_Protection_and_Retention.txt`, `.research/Compliance_and_Certification.txt`.

## The execution log is the highest-leverage artefact in the whole programme

One capability — a complete, queryable, tamper-evident (append-only, integrity-verified) record of what the agent did, with what data, on whose behalf — satisfies GDPR Art.17 erasure evidence, AI Act Art.73 incident investigation, SOC 2 evidence of production execution, and AI Act deployer logging duties simultaneously. Required fields per session: triggering request + authenticated principal, tenant/region/legal-basis policy, records retrieved with provenance, every tool call (tool, args, result, side effects), model/snapshot/prompt version + router decision, guardrail evaluations, human interventions (who/when/how long), token counts + cost reconciled to billing. Build this once, properly, before anything else — retrofitting later costs multiples of building it right the first time.

## Erasure: crypto-shred, never soft-delete

Vector stores implement deletion as metadata-level soft delete by design (to preserve index performance) — the embedding stays on disk. Article 17 requires *verifiable, irreversible* erasure across every storage layer including backups. Mechanism: each data subject gets a data-encryption key (DEK); all their data and derived artefacts are encrypted under it; erasure destroys the DEK. A backup restore afterward cannot resurrect the subject, because the restored ciphertext has no key — this is what makes crypto-shredding compatible with backups.

**Every location needs a named erasure mechanism** — primary store, vector index, semantic cache, agent memory, experience store, execution log, backups, provider-side transit — or it's a defect. Erasure is a durable workflow (Component 9), not an API call: it spans systems, needs retries and an audit trail, and human review for legal holds.

**Release gate**: create a synthetic subject, exercise it through vectors/cache/memory/logs, issue an erasure request, then attempt recovery from raw storage, every cache, and a pre-request backup. Any recovered fragment fails the gate — run this on every release touching storage.

## Retention

| Class | Retention | Basis |
|---|---|---|
| Prompts/completions | 30 days default | Debugging; tenant-configurable to zero |
| Execution log (metadata) | 24 months | AI Act logging, SOC 2, Art.73 |
| Execution log (content) | 30 days, then redacted | Minimisation |
| Vector index | Tenant lifetime | Dropped on offboarding by namespace |
| Agent memory | 12 months rolling | Staleness risk beyond this |
| Billing records | 7 years | Statutory, pseudonymised |
| Backups | 35 days rolling | Key destruction handles in-window erasure |

## Residency — a routing constraint, not a config flag

Record six attributes **separately** per provider (a single "EU" claim conflates them): storage location, processing location, retention period, training use, subprocessor list, governing jurisdiction. Tenant region must be a first-class input to the routing/fallback chain — "no eligible in-region provider" must fail the request, never silently cross the boundary. ZDR (zero data retention) is contractual and must be actively applied for with every provider carrying EU traffic, never assumed.

## Agent memory governance

Scope-limited write policy (explicit allowlist of what may persist — everything else session-only); provenance on every entry (origin + trust level, untrusted sources demoted at retrieval); source isolation (external content never treated as authenticated user input in a write decision); a compaction filter that strips untrusted content before it survives into persistent memory (memory poisoning is OWASP ASI06 — it decouples the injection from the damage across sessions, so single-session monitoring misses it). Users must be able to view, correct, and delete their own memory entries.

## Article 50 transparency (already enforceable)

Disclosure must be perceivable in the interaction itself — see `.claude/rules/interface-standards.md` for the interface requirements. Deployers cannot rely on provider-side marking to discharge their own duty; if this platform is deployed white-label, the contract must state who discharges which obligation.

## SOC 2 posture

No AI-specific SOC 2 standard exists yet — auditors apply the 2017 Trust Services Criteria plus an OWASP LLM Top 10 overlay (prompt injection is cited in nearly every 2026 audit evidence request). Scope Security + Confidentiality at minimum, add Availability once SLAs are contractual, add Privacy since personal data is processed. Type II (3–12 month observation window) is what enterprise buyers require — the observation window must start in Phase 1, not at first sales conversation. ISO/IEC 42001 typically follows in year two, worth prioritising for EU buyers.

## API/contract versioning

Three independent version planes — public API, webhook payload, workflow definition — because a durable workflow may outlive the API version that started it. URL path versioning for the public API; additive changes never bump the version. Signal deprecation in-band: `Deprecation` header (RFC 9745) + `Sunset` header (RFC 8594) + `Link` to the migration guide, 6–12 months notice.
