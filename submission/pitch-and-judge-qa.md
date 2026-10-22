# Judge's-eye pitch and technical answers

## Elevator pitch (20 seconds)

“RouteRescue is a rescue room for volunteer meal delivery. When drivers cancel, a stateful MCP agent recalculates three genuine alternatives, shows the trade-offs, checks every doorstep and requires exact human authorisation before touching the real schedule. Then we deliberately create a scenario no algorithm can fully solve—and the software proves why and refuses to pretend.”

## Five-point live pitch outline

1. **Pain:** Every cancellation creates a constrained allocation problem, not a simple notification.
2. **Agent:** Twelve MCP tools expose scheduling knowledge and actions, while actual agent commands carry forward live operational context.
3. **Algorithm:** Independent route feasibility checks under three alternative objective policies.
4. **Demo:** Cascading failure, compare routes, approved commit, safe rollback, capacity-impossible case.
5. **Credibility:** Reproducible CLI benchmark and honest limitations; local/offline demonstration.

## Likely hard questions

**“Is this just an API wrapper?”** No. The core engine is a deterministic route heuristic with independently verified hard constraints. The local contextual interpreter is not even a hosted LLM; the agent workflow is built from actual MCP tool calls. We explicitly do not claim free-form AI reasoning.

**“Is this really MCP, or an endpoint called MCP?”** MCP v2025-11-25 `initialize`, `notifications/initialized`, `tools/list`, `tools/call`, JSON-RPC structured results and required transport headers are implemented and checked through a separate HTTP client. See `server/mcp.js`, `docs/MCP-INTEGRATION.md`, and `npm run smoke`.

**“Did you implement Amazon's Alexa+ official SDK?”** No. The official hackathon FAQ says those gated preview developer tools are unavailable to general participants and that a self-hosted MCP server with a custom simulator is acceptable.

**“What is actually hard about the planner?”** It must maintain an invariant for every delivery while searching competing objectives through multiple driver disruptions. There is a greedy baseline plus weighted multi-start insertion, bounded ejection repair, cross-route local search and deterministic large-neighbourhood search and independent strict verification. The system displays partial outcomes when appropriate.

**“Does it always find the best possible route?”** No. It is an explicitly bounded heuristic, not an exact optimisation solver. Benchmarks compare reproducible synthetic seeds; no claim of universal improvement or global optimality is made.

**“Does the agent approve its own actions?”** No. Its MCP tool cannot generate the random human approval token, and the commit operation requires an exact proposal digest, current state version, token hash match and expiry. Rollback is separately gated. For production, this would need proper identity and hosted authentication.

**“Is the digital twin really read-only?”** Yes. It forks versioned operational data into bounded worker threads. The live state and audit are unchanged by simulations, a separate validator independently checks recovered assignments, and stale results are rejected. A coordinator can explicitly stage **confirmed real facts** from a what-if, but this is a distinct, acknowledged action that creates proposals, not an automatic commit.

**“What happens if I approve a hypothetical backup and then undo?”** A hypothetical backup does not enter the live roster until the coordinator confirms it. Even afterward, a newly recalculated proposal requires explicit single-use authorisation. Rollback returns the original first-change driver roster, shifts and assignments; no ghost relief driver remains. Tests cover this.

**“Does 32/40 coverage prove the optimiser is optimal?”** In the four-driver synthetic crisis, each remaining driver has eight stop slots, giving a **capacity lower bound of eight uncovered stops**. The optimiser independently finds a feasible plan covering 32, so eight uncovered is mathematically minimal **for the stop-coverage objective in that scenario**. This says nothing about the optimal driving distance or other scenarios.

**“What if five drivers cancel?”** The optimiser will return a verified partial plan and list uncovered stops. It never silently drops deliveries. When remaining capacity is mathematically insufficient, it also displays the capacity shortfall.

**“What protects actual customer details?”** The current app contains no real customer data. It is a fictional local simulation. A future deployment would require encryption, authentication, consent, retention policies and security review.

**“Why does this matter beyond the hackathon?”** It targets a specific human workflow that volunteer delivery coordinators currently handle manually. Real impact is plausible but not validated; our roadmap prioritises interviews and privacy-reviewed pilot data before quantitative benefit claims.

**“How do your benchmark numbers work?”** Run `node scripts/benchmark.js`: machine-generated JSON and a readable report appear in `benchmarks/` and `docs/BENCHMARK.md`. Timings aren't directly comparable between one-plan and three-plan methods and use synthetic coordinates.

**“How close is the routing quality to the true optimum?”** We implemented an exact exhaustive solver for tiny synthetic cases. Across six deterministic six-stop variants, the heuristic covered every stop and its distance averaged 3.1% above exact optimum, with a worst observed gap of 6.4%. We make no optimality claim for the real 40-stop demonstration. Run `npm run oracle`.

**“Can a judge actually verify the recovered routes?”** Yes. Click **Download verified evidence** and then run `node scripts/verify-certificate.js <downloaded-file.json>`. The standalone validator does not invoke the planner; it independently replays route capacity, skills, travel assumptions, deadlines, shift bounds, coverage and claimed statistics. The SHA digest is alteration detection, not a trusted signature.
