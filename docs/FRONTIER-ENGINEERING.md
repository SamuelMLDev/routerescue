# RouteRescue Frontier v4 — Engineering dossier

## Essential distinction

The prototype operates on invented delivery data and cannot claim actual operational impact. Unlike a typical language-model dashboard, *one deterministic route planner* generates proposals, a *separate verifier* replays physical and timing constraints, and an optional *read-only AI planner* chooses among allowlisted MCP tools. No LLM can directly approve, commit, or fabricate feasible routes.

## The differentiator: minimum intervention discovery

1. Identify the current roster, blocked volunteers and remaining driver-stop slots.
2. Calculate an analytically rigorous lower bound: `max(0, numberOfDeliveries - availableStopSlots)`.
3. Enumerate backup capacities from zero to 16, with optional explicit delivery-window flexibility.
4. Eliminate candidates that violate the capacity lower bound **before solving**.
5. Use the priority-constrained recovery heuristic to evaluate remaining candidates within a configured calculation budget.
6. Independently verify every calculated plan with the transportable recovery-certificate checker.
7. Prefer feasible interventions using the stated hypothetical resource-unit scoring model; return partial candidates honestly.
8. When a full plan uses exactly the proven capacity lower bound without deadline extension, give a **proof of minimum additional stop capacity** (not of shortest routes or global cost optimum).

In the provided four-driver outage, 40 deliveries need coverage and available volunteers collectively have 32 stop slots. Exactly eight added slots are **necessary** by the pigeonhole principle; a verified eight-stop backup plan is **sufficient** in the synthetic fixture. That justifies a minimum *capacity* claim for the stated model. In scenarios where a heuristic finds no complete plan, this never proves infeasibility.

The optional candidate scoring model adds 12 imaginary mobilisation units for any backup, 3 units per added stop, and 11 units for each hypothetical 15-minute blanket window extension. **Units are not dollars or verified labour costs.** Default UI disallows blanket window extension in the minimum intervention search to respect recipient commitments.

## Source / test anatomy

| Capability | Source file | Defensible evidence |
|---|---|---|
| Intervention search | `server/interventions.js` | Lower-bound proof + independent validator |
| Multi-strategy route search | `server/planner.js` | Real 40-stop constraint checks |
| Portable independent checker | `server/certificate.js` | Self-contained route replay |
| Risk model | `server/uncertainty.js` | Seeded reproducible travel-time perturbations |
| Live vs hypothetical boundaries | `server/twin.js`, `server/store.js` | Tests confirm no mutation of the source state |
| 13 MCP tools | `server/mcp.js` | Network-level JSON-RPC tool discovery |
| Optional real LLM planner | `server/ai-agent.js` | Allowlist and malicious-output tests |
| Authenticated two-user simulation | `server/auth.js`, `scripts/auth-smoke.js` | HttpOnly session login and cross-user token replay denial |
| Directed road matrix support | `server/travel-matrix.js` | OSRM-compatible matrix validation and independently checked route metrics |

## Experiment evidence

Run `node scripts/evaluate-frontier.js`. The script creates `benchmarks/frontier-results.json` from 24 independently exhaustively solved six-stop synthetic micro-instances plus the 40-stop intervention proof. Exact optimality is limited to the micro-instances. Runtime and performance claims for large instances are not established by this test.

The robustness panel uses 400 seeded synthetic simulations with perturbed trip time and a shared congestion factor. The displayed percentage is a **frequency under artificial assumptions**, not a measured on-time rate. `server/uncertainty.js` publishes the RNG, perturbation distribution, seed and sample count; the test suite checks reproducibility.

## Real-world data adapter

Default scenarios deliberately use synthetic geometry. `scripts/build-road-matrix.js` can fetch a directed travel-time/distance matrix from an OSRM-compatible endpoint operated by the user, given a user-supplied geocoded manifest. Missing directed edges fail closed; the prototype will not invent road travel data. The default Windows demo does not require an OSRM server or any network account. See [ROAD-DATA.md](ROAD-DATA.md).

## What is NOT yet implemented

- An external OR-Tools large-instance solver comparison. Exact comparisons are for tiny instances only.
- PostgreSQL transactions, a distributed scheduler, enterprise SSO, multi-tenant separation, audit anchoring, or a fully hosted Alexa+ preview integration.
- General-purpose autonomous state-changing AI. The optional LLM is intentionally **read-only**, and coordinator-origin authorisation remains mandatory.

These are deliberate, documented boundaries rather than implied capabilities.
