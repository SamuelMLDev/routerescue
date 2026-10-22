# RouteRescue Evidence Edition v5.0 — submission inventory

**This ZIP contains a functioning local project. It has NOT been submitted to Devpost automatically.**

| Item | Status | File / next action |
|---|---|---|
| Primary Alexa+ track: real self-hosted MCP 2025-11-25 | ✅ Implemented | `server/mcp.js`; `npm run smoke` |
| Native tool calls at runtime, not label-only integration | ✅ Implemented | `server/index.js`, `server/agent.js` |
| Multi-incident routing with three strategies + bounded LNS | ✅ Implemented | `server/planner.js`, `seed/incident-lab.json` |
| Minimum-intervention discovery with a mathematical capacity proof | ✅ Implemented | `server/interventions.js`, `src/twin.js`, `tests/interventions.test.js`; capacity-only proof applies to the supplied fixture |
| Optional real AI read-only MCP tool planning | ✅ Mock-tested | `server/ai-agent.js`; not tested with a paid hosted model; offline path works without keys |
| Directed road-travel model adapter | ✅ Unit-tested | `server/travel-matrix.js`, `scripts/build-road-matrix.js`; real external road requests not tested |
| Coordinator login and cross-user approval separation | ✅ Network-tested | `server/auth.js`, `npm run auth-smoke`; local mode, not production SSO/database |
| External SciPy HiGHS reference — 128 proven tiny instances | ✅ Measured | `benchmarks/highs-reference.json`, `scripts/reference-benchmark.py`, docs/EXTERNAL-REFERENCE-VALIDATION.md |
| Offline intent/safety challenge suite — 82 cases | ✅ Measured | `npm run agent-challenge`, `benchmarks/agent-challenges.json`; curated study, not a hosted model test |
| AI-provider-to-MCP network contract including malicious plan and outage | ✅ Tested with local compatible provider | `npm run model-contract`; live external provider not verified |
| Exact-oracle evidence for 24 small benchmark instances | ✅ Reproducible | `npm run frontier-benchmark`, `benchmarks/frontier-results.json`; no OR-Tools runs |
| Operational digital twin and failure-resilience sweep | ✅ Implemented | `server/twin.js`, `src/twin.js`, worker and API tests |
| Confirmed-facts staging and exact pre-incident rollback | ✅ Implemented | `server/store.js`, `tests/staging.test.js`; never automatic approval |
| Responsive Resilience Lab with verified simulations | ✅ Captured | `docs/screenshots/15-resilience-lab-empty.webp` through `23-minimum-intervention-theatre.png` |
| Independently verifiable portable recovery certificate | ✅ Implemented | `server/certificate.js`, offline CLI, `docs/ORACLE-EVIDENCE.md` |
| Tiny exact optimum comparisons with measured gaps | ✅ Reproducible | `npm run oracle`, `benchmarks/oracle-results.json` |
| Coordinator approval bound to exact proposal version | ✅ Implemented | `server/store.js`; token replay tests |
| Exact rollback and checkable audit chain | ✅ Implemented | `/api/audit`; tests |
| Full v5 automated test suite | ✅ 58/58 passed | `npm test`; direct run around 114 s |
| Reproducible tests and benchmarks | ✅ Included | `npm run check`; `npm run benchmark`; `node scripts/stress.js 240` (existing unit tests plus 82 offline agent challenge cases and optional external reference study; 240 synthetic stress cases) |
| Complete source code and local Windows instructions | ✅ Included | `README.md`, `docs/WINDOWS-SETUP.md`, `.bat` scripts |
| Public repo with source and open-source licence, or authorised private reviewer access | ⬜ Submitter | Upload repo and copy URL |
| Public video under 3 minutes in English | ⬜ Submitter | Record app using `submission/video-script.md`, upload YouTube/Vimeo |
| Team details, links and written fields | 🟨 Drafted | Fill bracketed items in `submission/devpost-submission.md` |
| Mandatory product feedback about actually used tools | 🟨 Drafted | Review and paste; don't claim unused SDKs |
| Optional friction log entries | 🟨 Research-backed suggestion only | Add real reproducible experiences; no invented vendor bugs |
| Hosted demo | ⬜ Optional / recommended | If hosting, add authenticated HTTPS; local version alone runs |
| Windows native `.bat` verification | ⬜ Submitter | Scripts designed for Windows; only equivalent Node runtime tested here |
| AWS Builder mini-challenge | ⛔ Not claimed | No qualifying AWS service integrated |
| Separate Open Source mini-challenge | ⛔ Not claimed | Publicising main project alone doesn't qualify |
| Clean clone test | ⬜ Submitter | Fresh folder → `npm run check` → `npm start` |
| Actual Devpost submission confirmation | ⬜ Submitter | Complete and submit online |

Official rules and FAQ are at https://amazonappdev2026.devpost.com/rules and https://amazonappdev2026.devpost.com/details/faqs .
