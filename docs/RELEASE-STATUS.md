# RouteRescue Evidence Edition v5 — Release Status

**Working offline demo:** self-hosted MCP 2025-11-25 server, Incident Lab, counterfactual digital twin, version-locked human approvals, complete rollback, independently checked route certificates.

**Direct technical checks:** 128 synthetic small instances solved independently with SciPy HiGHS (`benchmarks/highs-reference.json`), 82 curated intent/safety utterances matched (`benchmarks/agent-challenges.json`), local HTTP model-compatible provider smoke test including malicious model response and provider outage (`npm run model-contract`), and official-rule compliance mapping in `docs/JUDGING-AND-COMPLIANCE.md`.

**End-to-end smoke run:** `node scripts/smoke.js` completed successfully in this release environment. The full v5 test suite completed successfully: **58/58 tests passed**, duration approximately **114 seconds**. Focused v5 tests and the independent model contract also passed.

**External-model semantics:** the adapter is implemented and tested with local compatible responses. No hosted-model key was supplied, so arbitrary live-model prompt accuracy is not claimed.

**Browser visual review:** Evidence Centre desktop and 375px layouts rendered from packaged benchmark JSON in an isolated browser fixture. Browser security blocked direct navigation to the local HTTP server, so these screenshots verify page rendering, not hosted transport.

**Operational scope:** synthetic routing geometry, optional directed travel matrix, local single-process persistence and optional local coordinator authentication. Not a production Alexa+ service or road-navigation system.

**Submission:** the source archive is not a Devpost entry. GitHub publishing, video recording, form completion, and native Windows batch execution remain submitter actions.
