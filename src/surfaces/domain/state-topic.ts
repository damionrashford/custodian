import { brand, type Brand, type Namespace, type RunId } from "@custodian/primitives";

/**
 * The channel one run's state is broadcast on.
 *
 * A topic name is a security boundary, not a routing convenience: `ws.subscribe(topic)` takes a
 * bare string, so a transport that lets a client name its own topic has handed every subscriber the
 * ability to name someone else's. The defence is the same one the vector index uses — make the
 * illegal name unconstructable rather than checking for it after the fact.
 *
 * Three properties hold together, and each is load-bearing:
 *
 * 1. **The type is branded and this is its only constructor.** There is deliberately no
 *    `parseStateTopic`. A topic never arrives from outside; it is always derived. A caller holding
 *    an arbitrary string has no way to turn it into a `StateTopic`.
 * 2. **A `Namespace` is required to derive one, and `namespaceFor(claim)` is the only way to obtain
 *    a `Namespace`** (`src/knowledge/domain/namespace.ts`), which takes a *verified* tenant claim.
 *    So naming another tenant's topic requires first holding another tenant's verified claim, which
 *    is the boundary the whole platform already rests on.
 * 3. **The namespace is inside the name, not beside it.** Nothing downstream has to remember to
 *    filter by tenant, because two tenants watching the same run id are on two different channels.
 *
 * The consequence at the transport is that a cross-tenant subscription is not refused — it is
 * unrepresentable. A viewer that asks to watch a run belonging to another tenant is subscribed to a
 * topic in *its own* namespace, which nobody ever publishes to, so it receives nothing rather than
 * receiving a refusal that tells it the run exists.
 */
export type StateTopic = Brand<string, "StateTopic">;

/**
 * The delimiters are safe because `TenantId` and `RunId` are both `^[a-z]_[0-9a-z]{26}$` — no colon
 * can appear inside either, so no pair of inputs can produce a topic another pair also produces.
 * That is an invariant across three files, which is why `tests/surfaces/state-topic.test.ts` pins it
 * against the parsers rather than trusting the shape here.
 */
export function topicForRun(namespace: Namespace, runId: RunId): StateTopic {
  return brand<StateTopic>(`state:${namespace}:run:${runId}`);
}
