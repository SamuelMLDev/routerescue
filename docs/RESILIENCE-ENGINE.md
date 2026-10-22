# RouteRescue v3 — Architectural and mathematical design

## 1. Operational guarantees and their limits

The key invariant is **each delivery is either assigned to exactly one available, qualified driver on a validated route, or explicitly uncovered**. An unassigned stop is never silently dropped. Route simulations check cumulative load, stop-count vehicle capacity, skills, time windows, service duration, returns to depot, individual shift ends, unavailable drivers and optional driver locks. The planner checks feasibility after construction and again before approval. An independent certificate module recomputes these facts without calling the planner.

RouteRescue does **not** assume a language model can optimise routes, waive physical constraints or authorise a state change. The finite-state interpreter translates some English phrases into validated tool calls. Its supported vocabulary is limited and user instructions outside it may be misunderstood or rejected; the MCP tools are the explicit boundary.

## 2. Mathematical model

Let `D` be stops, `V` drivers, `r_v` the ordered route assigned to driver `v`, and `U` the uncovered stops. A valid assignment partitions `D` into the disjoint union of all `r_v` and `U`. For each driver, cumulative parcel load cannot exceed `maxLoad`, route length cannot exceed stop-count capacity, drivers cannot service tasks requiring skills they lack, and the total travel/service/waiting time must respect each stop's window and the driver's shift end. Drivers marked unavailable have empty routes. An optional `lockedDriver` makes a stop unassignable to any other driver, even under outages.

The objective is **lexicographic**: minimise uncovered priority stops, then uncovered stops, then improve a strategy-specific cost. The distance strategy minimises estimated kilometres; balanced adds workload spread and stop-count imbalance; priority emphasises preserving urgent commitments and conservative deadline slack. The weights are heuristics and should not be interpreted as calibrated operational utilities. Time/distance use a deliberately synthetic Manhattan geometry and fixed effective speed, not an actual road network.

## 3. Search and complexity

The seed solution follows multiple deterministic stop orderings. Each candidate inserts stops at valid positions, attempts bounded one-level ejection repairs and improves valid assignments through cross-route relocation. A bounded deterministic large-neighbourhood search removes clusters/contiguous route segments, reconstructs them under the same feasibility checks and retains only strict lexicographic improvements. This is **not** optimality-proving branch-and-bound for full-size instances. Tests compare six tiny synthetic cases with a separately implemented exhaustive distance optimum. In larger cases, 'partial' means no full solution was found by the bounded search; it is not by itself an infeasibility certificate.

If total available driver-stop capacity `C` is less than stop count `N`, at least `N-C` stops are uncovered in every possible assignment; **this one-sided bound is mathematically valid** even before considering deadlines or skills. No opposite claim is made when `C >= N`.

## 4. State authority and changing assumptions

The main state lives in an atomically renamed local JSON file. A cancellation or shift-end edit invalidates previously generated proposals, selections and approval authority. A proposal is tied to the latest source state version and a SHA-256 digest of its route contents. A browser-issued random token authorises precisely that proposal and version, once, for at most 120 seconds. A second commit or changed version is rejected. A similarly guarded rollback restores the first-change baseline, including original routes, original driver roster, original stops and shift cutoffs. It removes any subsequently confirmed relief driver rather than leaving ghost backup capacity behind. Mutations are synchronous within one Node.js process, which serialises operations; **multiple server processes against the same JSON file are not supported**.

Every event contains a sequential hash of its metadata and the preceding event hash. Checkpoints record the state after a write, allowing read-only forensic inspection of earlier state versions. These are **not** externally timestamped, authenticated or protected against a malicious filesystem administrator. A reset begins a new scenario session. `data/` must not be treated as a durable compliance audit system.

## 5. The operational digital twin

A counterfactual deep-copies current state, validates input and optionally applies hypothetical unavailable drivers, a synthetic backup driver, a global stop-window extension or per-driver shift changes. Newly infeasible existing routes are released for redistribution rather than being silently retained. The solver constructs alternatives and an independent verifier checks the selected output. Each result includes the version of the source state that was forked. Read-only simulations never alter dispatch or carry approval authority. To turn a scenario into a new proposal, the coordinator must explicitly confirm observed absences, changed shifts and relief resources: staging writes these confirmed operational facts only, invalidates old proposals and generates new candidates through actual MCP tools. Window extensions are rejected for promotion because a speculative delivery deadline must not silently change recipient promises. The new candidates still require separate version-bound human approval. The UI cannot commit hypothetical assignments directly; the HTTP layer rechecks version after long-running calculations, so stale outputs are not presented as current.

The simulation runs in a Node worker thread with a 45-second timeout and limited concurrency, leaving the HTTP/MCP controller responsive. No network keys are used. A 40-stop operation with several cancelled drivers can return truthful partial coverage; adding hypothetical capacity changes the assumptions and can permit complete coverage. No future events are predicted, and none of the simulation outputs is a measured real-world performance claim.

## 6. Proactive resilience analysis

Read-only resilience analysis independently removes each currently available driver, runs the priority policy and ranks outcomes. The analysis reports reassigned obligations, uncovered urgent and normal stops, mileage and minimum slack. It is **not** a probability model. The current synthetic fixture is resilient to single-driver loss, so many risk scores may tie at zero uncovered; the ranking is illustrative, not evidence of a causal risk ranking in real organisations.

## 7. MCP interoperability

`POST /mcp` uses JSON-RPC 2.0 with `initialize`, `notifications/initialized`, `tools/list` and `tools/call` for MCP protocol version `2025-11-25`. It returns stateless JSON responses and accepts proper `Accept: application/json, text/event-stream` headers. The twelve tools include read state, assess disruption, set status, change shift, propose, calculate alternatives, select, commit, undo, verify audit, read-only simulate, and resilience analysis. Inputs are schema-restricted and MCP commits require coordinator-origin tokens which are not exposed as agent tools. This is a self-hosted MCP simulator; no restricted Alexa+ preview access is claimed.

The browser API is bound to localhost by default. It has origin checks but lacks production identity, tenant isolation and reverse-proxy authentication. Do not expose this server directly to the public internet without designing appropriate authentication, rate limits, persistence and access control.

## 8. Adversarial tests, fault cases and what to challenge

Try removing all drivers, shortening shift ends, double-committing a proposal, providing an expired version, corrupting exported evidence, sending malformed JSON, attacking tool schemas, running an impossible-capacity crisis, changing the dispatcher state during a worker simulation and opening multiple clients. The system should reject invalid actions clearly and never commit an uncovered plan. For still-possible but hard routing instances, the planner may leave stops uncovered rather than make unsafe assignments.

Reproduce with `npm test`, `npm run smoke`, `npm run stress`, `npm run benchmark`, `npm run oracle`, and `node scripts/verify-certificate.js <file>`.

## 9. Remaining research and deployment limitations

Travel assumptions are synthetic; scenarios are not sampled from real charities; vehicle loads do not model multiple pickup/resupply trips; the solver is not proven globally optimal; the finite-state interpreter does not understand arbitrary speech; checkpoint hashes are not signatures; public hosted authentication and fleet integrations are absent. Measuring a real efficiency benefit would require a separate study. Improvements should not obscure these facts.
