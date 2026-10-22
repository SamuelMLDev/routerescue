# Verification — RouteRescue Incident Lab

## Actually executed

- `node --check`: validated JavaScript module syntax for backend and frontend.
- `npm test`: **58 passing tests** including a stand-alone certificate validator and tiny exhaustive search oracle; unit suite for MCP schemas, intent interpretation, 40-stop multi-driver planning, partial capacity crisis, determinism, windows, volume, skills, version-bound approval, replay denial, full rollback and audit tampering detection. Check the actual terminal output in the current version of the repository.
- `npm run smoke`: fresh child process on a random port with its own temporary data file. Exercises the network MCP handshake, origin rejection, thirteen tool discovery, 16-stop recovery, rejected unapproved commit, token approval, one-time commit, rollback, CSV, agent-driven MCP tools, counterfactual promotions with separate human authority, worker-isolated simulation and risk sweep, versioned read-only checkpoint history, two-driver cascading scenario, stale state protection, audit verification and blocked approval of partial recovery.
- `npm run oracle`: six exhaustive 6-stop instances show **1.031× mean** and **1.064× worst** distance ratio for the new distance heuristic, compared with exact best on those synthetic instances; no extrapolation to 40 stops.
- `node scripts/stress.js 240`: **240 synthetic fault/property cases; zero failed independent feasibility checks, 1,000 malformed configurations rejected.** The recorded mix of covered and uncovered cases reflects randomly imposed capacity and time-window restrictions, not an availability success rate.
- `node scripts/verify-certificate.js docs/sample-recovery-certificate.json`: independently recomputes every synthetic route constraint with no planner calls.
- `node scripts/benchmark.js`: reproducible original-versus-upgraded solver comparison on the same 16-stop fixture and multiple 40-stop outages. Results recorded as JSON, not invented statistics.
- Chromium visual exploration: desktop original dashboard, Incident Lab ready state, two-driver disruption, plan switch, MCP event inspection, approval, rollback and mobile capacity-crisis state. No page JavaScript exceptions during the originally captured sequence. Resilience Lab was also rendered in Chromium with an HTTP forwarding bridge, including its live 32/40 capacity failure, hypothetical 40/40 recovery with backup resources, proactive driver-failure ranking, forensic checkpoints and a 375px mobile viewport. The explicit scenario staging UI was browser-click-tested end to end: independently verified 40/40 hypothetical → coordinator confirmation → newly computed 40/40 live proposal → human exact approval → commit → exact rollback to the original eight-driver roster, with zero page errors. Two additional screenshots demonstrate the confirmation and fresh approval screens. Native Windows GUI/browser interaction remains unverified. Screenshots in `screenshots/`.

### Browser testing caveat

The execution environment prevents Chromium from reaching localhost directly. Screenshots were rendered with the actual frontend JavaScript and CSS inside Playwright, while a transparent Python fetch bridge forwarded the browser's HTTP requests to the running Node server. HTTP and MCP flows were also tested independently with unmodified network clients. The bridge is an environment-specific test harness and is not part of the shipped app.

### Supported screen widths

375px handset, 768px tablet and 1536px desktop responsive rules are implemented and visually explored. The Resilience Lab had no horizontal document overflow at 375px in the tested Chromium bridge run; the broader legacy interface was visually checked but is not certified pixel-perfect in every browser.

## Honest limitations

- Only Linux runtime was available. Native double-click execution of Windows `.bat` files was **not tested**; equivalent Node.js commands did work.
- We did **not** independently run Amazon Alexa+ official preview SDKs or a physical Alexa device; the official hackathon permits this self-hosted simulator path.
- We did not run an official MCP Inspector or certify every optional MCP feature. This is a subset of stateless Streamable HTTP (JSON mode only, no server-originated SSE, no sessions).
- No formal WCAG audit, screen reader testing or real-world route pilot has been performed.
- Neither map kilometres nor business benefit is based on licensed live traffic, measured customer travel or a control-group deployment.
- Hash-linked audit entries are not externally anchored; someone with filesystem write access can recompute hashes. For remote deployment, add authenticated identities, signed audit anchoring and storage locks.
- Built-in human approval is appropriate for a trusted single-user local simulation, not production identity assurance.

## Frontier v4 additions (rerun to verify)

- **Minimum intervention** `node --test tests/interventions.test.js`: read-only objective search, a rigorous eight-slot capacity bound and independently replayed sufficient assignment; adversarial impossible-capacity cap.
- **Directed travel data** `node --test tests/roads.test.js`: asynchronous return legs are distinct and the separate checker agrees; missing directed edges fail closed.
- **Optional AI** `server/ai-agent.js`: the unit suite uses a fake compliant HTTP model response; no live paid provider invocation has been verified. Malicious tool names, imaginary drivers, invalid capacities and 4+ untrusted actions are rejected.
- **Optional secure sessions** `npm run auth-smoke`: independently launched server, two actual local login sessions, per-actor approval/rollback and cross-user replay denial. This is still not multi-process or enterprise-grade.
- **Expanded small-instance benchmark** `npm run frontier-benchmark`: exact exhaustive comparison on 24 reproducible synthetic six-stop instances and minimum-capacity evidence on the forty-stop scenario. All large-scale global-optimality claims remain prohibited.
- **Uncertainty** `server/uncertainty.js`: 400 seeded, bounded synthetic perturbations; not a real on-time delivery forecast.
