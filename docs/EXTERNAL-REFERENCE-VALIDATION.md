# Independent Reference Validation — RouteRescue v5

## What is independently solved?

The production optimiser in `server/planner.js` searches feasible recovery plans using bounded multi-start constructive search, ejection repair, relocation and large-neighbourhood improvement. Because it is heuristic, it has no general optimality guarantee.

To evaluate it, `scripts/reference-benchmark.py` generates reproducible synthetic 5- and 6-delivery scenarios. It **independently enumerates every feasible driver sequence** (up to vehicle capacity), modelling travel, return time, delivery windows, waiting and vehicle load without importing JavaScript optimisation code. It then solves a **binary route-selection set-partitioning MILP with SciPy HiGHS**. The MILP chooses at most one feasible route per driver; each delivery is assigned to exactly one chosen route or a penalty-bearing uncovered variable.

The objective is ordered by sufficiently separated penalties in these bounded fixtures: missed priority deliveries, missed other deliveries, then summed route distance. A reference result with `status=OPTIMAL` means the external solver established an optimum of this **small enumerated formulation**, not an optimum for a large 40-stop operation.

## Reproduce

Python 3.11+ and Node.js 22.12+ are required for **the optional research runner**. The end-user application requires Node.js only.

```sh
python -m pip install -r research-requirements.txt
npm run reference-benchmark
```

The runner creates `benchmarks/highs-reference.json`. It regenerates fixtures from `seed=0xc0ffee27` and stores a SHA-256 digest of the generator's serialized input, per-case external optimum, heuristic coverage, distances, timings, and known limitations.

## Recorded 128-case reference study

| Measure | Observed |
|---|---:|
| Small synthetic instances | 128 |
| Reference cases with mathematically proven optimal solutions | 128 |
| Production heuristic cases with same delivery coverage as the reference | 128 |
| Production heuristic complete-cover cases | 128 |
| Mean heuristic distance above external optimum (comparable cases) | **1.63%** |
| Worst distance above external optimum | **16.67%** |

These numbers are measurements, not promises. Particularly, **16.67% is an observed worst-case gap on these fixtures**. Showing a credible failure case is more valuable than erasing the discrepancy. Coverage and priority protection are compared lexicographically before distance. Ratios are reported only for comparable coverage/priority cases.

The reference uses **SciPy HiGHS, not Google OR-Tools**. No OR-Tools comparison is claimed. The reference benchmark is intentionally bounded: exhaustive route enumeration is exponential and is not intended to solve a 40-stop operational instance. For the larger incident lab, the independent plan certificate proves **hard-constraint feasibility**, not optimum; the eight-stop-slot minimum proof applies to the special capacity-bottleneck scenario.

## Additional evidence

- `benchmarks/frontier-results.json`: 24 small exact-oracle cases and capacity example.
- `benchmarks/stress-results.json`: seeded route-invariant perturbations on a synthetic 16-stop fixture.
- `benchmarks/agent-challenges.json`: curated offline intent/safety cases, not live hosted-language-model accuracy.
- `node scripts/model-contract-smoke.js`: HTTP mock model → validated read-only MCP call → independent route verification → preserved operational version, plus malicious tool and provider-failure paths.
- `scripts/verify-certificate.js`: stand-alone portable certificate verifier.

**Interpretation guardrail:** simulated on-time percentages are not calibrated field probabilities; schema validation and mocked hosted-model responses are not proof of semantic reliability with an arbitrary external model; synthetic routes are not turn-by-turn navigable road plans.
