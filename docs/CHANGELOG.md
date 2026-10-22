# Changelog

## 4.0 — Frontier: minimum intervention and independent evidence

- Added a bounded, read-only **Minimum Intervention Engine** that searches resource capacity and optional timing flexibility; gives an exact *minimum extra driver-stop slots* proof only when a capacity lower bound is matched by an independently verified complete plan.
- Added an interactive Recovery Theatre with a proof chain, alternative intervention candidates, a live map, and seeded synthetic uncertainty frequencies (not real-world service levels).
- Added an optional OpenAI-compatible read-only model planner calling three tightly allowlisted real MCP tools; offline operation remains deterministic.
- Added an optional authenticated coordinator mode with short-lived HttpOnly sessions, cross-coordinator replay rejection, and internal-only MCP mutation gateway. This does not represent production identity infrastructure.
- Added operator-supplied OSRM-compatible **directed** road matrices with independent routing/certificate verification; no claimed external road service was tested.
- Expanded exact-oracle comparisons to 24 synthetic six-delivery instances, with results in `benchmarks/frontier-results.json`. No OR-Tools comparison has been run.
- Expanded network smoke testing, security tests, and unit tests; bundled Windows double-click launch scripts.

## Previous releases

## v3.0 — Resilience Engine

A significant engineering and product upgrade to the v2.1 Incident Lab:

- **Operational Digital Twin:** read-only, versioned counterfactuals with arbitrary known driver outages, a hypothetical additional driver, stop-window extension and per-driver shift changes. A new view features a route map, strict capacity lower bounds, three genuine policy trade-offs and evidence export. The live dispatch state is not modified by any what-if call.
- **Confirmed-facts staging with human authority:** simulation remains read-only, but coordinators may explicitly acknowledge observed absences, new shifts and relief capacity. This creates fresh verified candidate plans but never silently approves one. Unagreed delivery-window changes are rejected. Rollback restores the first-change roster, including removal of the relief driver.
- **Proactive Resilience Sweep:** runs the priority optimiser once per available driver's hypothetical absence and reports the resulting obligations, uncovered stops and minimum deadline slack. Clearly labelled scenario analysis, not failure-probability modelling.
- **Multi-objective large-neighbourhood refinement:** augments the existing multi-start, bounded ejection and relocation pipeline with deterministic cluster/route removal and feasibility-checked re-insertion. Retains only lexicographic improvements. No global optimality claim.
- **Changed-shift recovery:** available drivers whose new shift ends invalidate existing routes have their stops released for reassignment; previously, the solver could keep an invalid original assignment. Shift-end changes are now a distinct operational MCP tool.
- **Independent proof at simulation time:** digital twin outcomes run through both the primary feasibility checker and a *separate* evidence replay implementation before being displayed as verified. Constraint-violating evidence is rejected.
- **Worker isolation and stale-result handling:** CPU-heavy risk sweeps and simulations run in Node workers with bounded concurrency and timeouts. HTTP replies check the source-state version again after calculation.
- **Compound operational commands:** e.g., “Sam is out, Priya can only stay until 12 PM. Protect urgent deliveries” turns into separate validated status and shift tool calls plus a new plan. Read-only `what if` and `weakest link` commands dispatch to dedicated MCP simulation tools; the finite-state parser is not misrepresented as a general-purpose LLM.
- **Forensic checkpoints:** scenario-scoped read-only snapshots record the version, event type, audit head and operational status after each state write. Hash-linked logs are not falsely presented as externally anchored or tamper-proof.
- **Actual native browser testing with a localhost bridge:** desktop and 375px mobile screenshots were rendered from the frontend and live backend data; horizontal overflow at 375px was checked. Native Windows `.bat` script execution remains unverified on Linux.
- **Reproducible reliability:** 51 unit tests including independent phantom-driver-route rejection, coordinator staging and exact-baseline rollback, a fresh-process MCP/HTTP smoke test including simultaneous conflicting commits, six-case exact-oracle comparison, 240 seeded adversarial scenarios with zero invariant failures, and 1,000 rejected invalid configurations.

## v2.1 — Incident Lab

Eight-driver 40-stop fictional scenario, cascading incidents, three policies, approval tokens and exact rollback, hash-linked events, independent portable certificates, exact micro-oracle and a fully redesigned responsive dashboard. Previous changelog details remain in Git history if committed.

## v1 — Dispatch prototype

Local 16-stop scenario with a deterministic greedy repair algorithm, stateless MCP interface, interactive map and basic human approval.
