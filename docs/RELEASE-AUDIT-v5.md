# RouteRescue v5 — Release Audit

## Material changes since Frontier v4

1. **External optimisation authority:** `scripts/reference-benchmark.py` builds and solves a separate complete small-instance routing formulation with HiGHS MILP, comparing actual Node solver output. Published 128-case results include the worst observed gap, not just an average.
2. **True shortest-distance policy:** removed the residual workload-fairness penalty from the `distance` strategy's objective. Distance, balance and priority now have cleaner trade-off semantics.
3. **Language safety and paraphrase coverage:** the offline dispatcher now rejects negated mutations, prompt-injection instructions, mass-cancellation requests and ambiguous questions. Curated 82-case regression evaluation, results included. These are not a claim about general-language-model accuracy.
4. **Multi-turn counterfactual context:** a read-only follow-up such as “What if Sam is out?” → “And Priya too” now retains scenario context within the same actor/session and only while the live operational version is unchanged.
5. **Model-to-MCP network test:** `scripts/model-contract-smoke.js` runs a local protocol-compatible AI provider, drives the HTTP copilot through real MCP tools, attempts a malicious model-selected write and a provider outage, and verifies that the operational state remains unchanged. Real hosted-model credentials are optional and have not been supplied to the test environment.
6. **Evidence Centre:** new `/evidence` browser experience displays actual generated benchmark files, distribution graphics, model-boundary disclosure and an interactive challenge console. The console calls the running `/api/agent` endpoint and reports exact state-version changes.
7. **Rule compliance rechecked:** official judging weights and Alexa+ MCP requirements mapped to concrete code and verifiable submission items in `docs/JUDGING-AND-COMPLIANCE.md`.

## Verification taxonomy

- **Directly measured:** 128 exact external reference instances, 82 curated offline intent cases, 24 separate existing exact-oracle variants, the delivered example's 8-slot proof, independent certificate verification.
- **Local endpoint integration:** MCP JSON-RPC, virtual scenario flow, version-bound approval and rollback, model-compatible provider contract using a controlled local provider.
- **Not proven by these tests:** real provider semantic accuracy on unseen judge instructions, real-world road-time reliability, large-instance global optimality, production horizontal scalability, actual user adoption, or a specific Devpost ranking.

Do not modify these categories to imply tests happened that did not occur. Fix and rerun benchmarks after changing optimisation semantics or fixture-generation code.
