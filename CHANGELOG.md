# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The agent can run a shell command, read and write files in its workspace, fetch a page, and render
  one in a browser. Each declares what class of action it performs, and anything that cannot be
  undone needs a person's approval before it runs — with no reviewer configured, those actions are
  refused rather than allowed.
- Code the agent runs is confined: no network, a read-only filesystem apart from scratch space, a
  memory and process ceiling, and a time limit. A browser reaches the network only through a proxy
  that checks every request a page makes, not just the address the agent asked for.
- Files the agent reads and writes stay inside its own workspace. A path that would climb out is
  refused, however it is spelled.
- A design system: colour, type, spacing and motion held once as data, with the seven states an
  agent run can be in as first-class values rather than decoration.
- Every string a person reads lives in one catalogue, checked against the vocabulary rules for the
  audience that reads it. Errors say what happened, what it cost, and the one thing to do next.

- The execution log has append-only storage. A shortened run and a rewritten prefix are both refused
  at write time rather than only detected afterwards, and reads are scoped to the tenant the run
  belongs to.

- Tenant knowledge bases are isolated per namespace, and a namespace can only be derived from a
  verified tenant claim — there is no way to name another tenant's namespace.
- Data-subject erasure destroys the encryption key rather than deleting rows, so a restore from a
  backup taken before the request cannot resurrect the subject. Every storage location has a named
  erasure mechanism and a missing one is reported as a defect.
- Erasure runs as a nine-step workflow: an ambiguous identity escalates to human review instead of
  proceeding, a legal hold blocks and records its basis, and a repeat request returns the original
  proof.
- The execution log records what the agent did, with what data, on whose behalf, as a hash-chained
  append-only sequence. A mutated entry, a deleted entry and a rewritten link are each detectable.
- Requests are routed only to providers that both process and store in the tenant's region. When
  none is eligible the request is refused rather than sent across the boundary.
- Repeated delivery of the same request returns the first outcome instead of calling a provider
  twice, and the claim is recorded before any provider call so a failover cannot slip past it.
- Agent runs stop on a hard iteration ceiling, on repeated steps that change nothing, on a per-run
  cost ceiling, and before acting on an unverified result.
- Tool definitions load on demand. Sessions start with names and one-line summaries only, scoped to
  the task at hand, and the catalogue reports how many tools must be removed when it grows past
  budget.
- Long-running responses can resume from where a dropped connection stopped, without re-running the
  work or charging for it twice.
- Retrieved documents pass a guardrail rail before entering a prompt, so an instruction hidden in a
  fetched document is blocked even when the user's own message is benign.
- Safety and policy text is pinned and survives context compaction. Compaction that cannot fit the
  pinned text fails rather than dropping it.
- Agent memory records where each entry came from and demotes untrusted origins when recalling, in
  addition to refusing to persist them.
- Release gates report pass^k rather than pass@k, so an agent that succeeds intermittently fails the
  gate instead of clearing it.
- Prompt rollback repoints a deployment label at an existing version and names the caches that must
  be invalidated as part of the rollback.
- Approvals are tiered by risk, and a timeout on anything but the lowest tier denies rather than
  proceeding.
- Cost is reconciled across the provider invoice, metered events and the internal ledger at zero
  tolerance; a mismatched billing period is reported as incomparable rather than as a discrepancy.
- The execution log survives a restart. Entries persist in a durable store with the same write-time
  refusals as before, a row edited in the database itself is reported as corrupt rather than
  returned as evidence, and whole runs are disposed of when the metadata retention period elapses.
- LLM traffic is described in OpenTelemetry GenAI terms with the convention version pinned: a
  renamed attribute upstream is a deliberate edit here, never silent drift. Spans carry model,
  provider, and token counts only — request and response content cannot be represented.
- Metered usage is derived from the execution log itself, so the cost reconciliation that compares
  meter events against the provider invoice and internal ledger can now run on gateway traffic —
  and a usage event missing from the log raises an alert instead of reconciling.
- The first end-to-end agent: a question posted to the platform is answered from the tenant's
  knowledge base by a real model, with every step — who asked, which model, what was retrieved and
  under which screening, which tool ran, what it cost — recorded in the durable, verifiable
  execution log. Every response discloses that answers are generated by an AI system.
- The agent stops itself: an iteration ceiling, a stagnation detector, a per-run cost ceiling, and
  a halt on any unverified action, each with a plain-language explanation and nothing changed on
  the caller's behalf.
- Retrieved documents pass the injection rail before entering the agent's context; a blocked
  document is recorded and never shown to the model.
- Requests deduplicate across restarts. The record that a request was already claimed now survives
  a crash or a deploy, so a retry that arrives afterwards is answered from the first outcome
  instead of running the work — and being billed for it — a second time.
- Workspace credentials are signed. The platform verifies which workspace a request belongs to using
  a public key and cannot mint a credential itself, so a leaked verification key no longer lets
  anyone issue one — and a credential still expires, and still cannot be issued with an unbounded
  lifetime.
- An erasure proof now records who vouches for it. A record the platform wrote about its own
  erasure is marked as such and is refused where evidence is required, so a proof that only the
  erasing party can attest to cannot be mistaken for one an outside custodian issued.
- The first real model provider (xAI). Platform model pins translate to provider model ids at the
  adapter, an unmapped pin is refused rather than sent as-is, and raw provider errors never leave
  the adapter.

### Fixed

- Every completion the gateway serves now opens its execution log with an entry naming the
  principal, tenant, region and legal basis it ran under. That entry was never written, so a served
  call could not be attributed to whoever requested it.
- A refused or failed completion returns the run's log alongside the reason. Previously the log was
  discarded on every failure path, which left a request refused on residency grounds
  indistinguishable in the record from one that never started.
- The gateway continues the run's existing log rather than starting a second chain at sequence zero,
  which integrity verification reported as a gap once the two halves of a run were put together.
- The log seals the request that triggered a run. It previously sealed the prompt template, which is
  identical for every run on a version and already named by the recorded prompt version.
- A redelivered request that is still running is reported as in flight rather than as already served,
  and a run that ends in failure records that outcome instead of leaving the claim open for its full
  24-hour lifetime and answering every retry with a result that never arrives.

- Document chunks no longer exceed the configured token budget. Overlap was being added on top of an
  already-full chunk.
- An identical request repeated after the idempotency window now executes instead of silently
  returning a stale answer for work that never ran.

### Changed

- Claim signing keys can be rotated without invalidating claims already in flight. A claim now names
  the key that signed it and the platform holds a ring of trusted keys, so a rotation adds the new
  key, switches issuance to it, and retires the old one only once the longest live claim has
  expired. There is also a production claim issuer; it is deliberately not part of the serving path,
  because a platform that can verify a tenant identity must not be able to forge one.
- The vector index is durable. It previously lived in memory beside an execution log on disk, so
  after a restart a run's recorded retrieval cited documents nothing could produce again.
- Subject keys are held by a key custodian outside the process, so a restart no longer destroys
  every key. Content is sealed under a single-use key wrapped by a key-encryption key in HashiCorp
  Vault's Transit engine; erasing a subject destroys that key, and both the wrapped keys and the
  ciphertext are stored together because neither is of any use without it. Verified against a live
  Vault: sealing, unsealing, key destruction, the externally attested proof, and a repeat erasure
  returning the original proof all behave as intended end to end.
- The service refuses to start when a key custodian is half-configured — a Vault address with no
  token, or the reverse — even when the development-mode acknowledgement is also set. It previously
  had no such path to configure at all.
- An erasure proof names the key that was destroyed rather than the data subject, because a proof is
  evidence of a key destruction. The subject is recorded alongside it on the erasure outcome.
- A completion's prompt text and model now come from the prompt registry rather than the caller, so
  the version that produced an output is always recordable. The log previously stored the literal
  string `unversioned` for every call.
- Execution log entries record a principal, region, model snapshot, prompt version, provider and
  tool name as their own types rather than as free-form strings, and the duplicated `model` and
  `snapshot` fields — always written with the same value — are one field.

### Security

- An AI disclosure is carried in the interaction itself, at first contact and in the same weight as
  the surrounding text, and is versioned so a deployment can say which wording was shown when.
- A web address the agent asks for is checked against an allowlist before anything is looked up.
  Only ordinary web addresses are accepted; a request for a local file, a storage bucket or an inline
  document is refused, as is one carrying a password, one pointing at a private address, and one
  redirected to a host that was not allowed.
- The record proving a data subject was erased is now itself accounted for. It holds that subject's
  identifier, and it was in no data map, had no retention period, and could never be removed — the
  one store nobody could ask us to clear was also the one that named them. It is now declared as
  what it is, evidence retained for as long as the evidence is owed, and disposed of on that
  schedule. A new check refuses any durable store that has not been classified this way.
- A claim naming an unexpected signing algorithm is refused on its own terms rather than left to
  fail the signature check, and a claim naming a key the platform does not hold is refused before
  any signature is verified.
- Erasing a data subject now reaches their embeddings. The vector index held plaintext vectors, so
  destroying a subject's key removed the documents and left the embeddings intact — and an embedding
  can be inverted far enough to recover source text, which makes it a surviving fragment rather than
  a harmless derivative. Embeddings are sealed under the subject's key, and an entry that can no
  longer be opened is dropped from the index.
- A key destruction is only recorded as externally attested once the key is confirmed absent. A
  custodian that accepted the destroy request but left the key in place would previously have
  produced a proof of a destruction that never happened.
- A repeat erasure request returns the original proof after a restart. The proof is written to a
  durable deletion registry, so a second request can no longer mint a fresh record carrying a
  timestamp the destruction did not happen at.
- Idempotency claims are scoped to the tenant. Keyed by request hash alone, two tenants whose
  requests hashed alike shared one claim and the second was told its work had already been done.
- The gateway derives the tenant it records and the scope it stores under from a verified claim
  rather than accepting a tenant identifier from its caller.
- Execution-log content cannot be disposed of before its retention period elapses. The period is
  taken from the schedule and the storage key derived from it, so a caller can no longer destroy the
  incident-reporting window early by passing its own.

- Execution-log content and prompts/completions are held under separate retention keys. They shared
  one key, so a tenant exercising its right to zero retention on prompts and completions would have
  destroyed the incident-reporting window along with it.
- Principal identifiers are validated before they are recorded, and the pattern refuses anything
  shaped like an email address or a name. A principal identifier survives in log metadata for 24
  months, past the erasure of everything held under the subject key, which is defensible only while
  it is pseudonymous.
- An agent principal no longer carries card material. A card is verified once at handoff; copying it
  into the log would have made the record a queryable store of signatures at rest.

- Tenant claims are rejected unless they are signed, currently valid, not future-dated, and bounded
  to at most one hour of total lifetime. Previously a captured tenant claim — the credential that
  decides whose data a query may read — was valid indefinitely.
- Every store holding model content now holds ciphertext, and cache keys are digests rather than the
  prompt itself. Previously a completion could be crypto-shredded while the cache index still
  recorded what had been asked.
- The idempotency store is covered by the erasure data map. Completions held there were previously
  unreachable by an erasure request.
- Cached completions expire on the retention schedule instead of being kept indefinitely.

[unreleased]: https://github.com/damionrashford/custodian/commits/main
