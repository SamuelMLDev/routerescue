# Evidence that is independently checkable

The dispatch system is a **bounded heuristic**, not a proven global optimiser. We make that limitation testable rather than burying it in the pitch.

## A. Exact optimisation on deliberately small cases

We implemented a separate exhaustive solver at `server/oracle.js`. For **six synthetic deliveries and two available volunteers**, it enumerates valid driver allocations and delivery orders, pruning impossible or provably inferior partial routes. Larger cases are refused explicitly because exhaustive search scales exponentially.

On six reproducible tiny synthetic layouts (`node scripts/oracle-benchmark.js`), the production **shortest-routes** heuristic covered 6/6 deliveries in each case. Its recorded kilometres were **3.1% above the exact optimum on average**, with a **6.4% worst case** across these six layouts. These figures are rounded, machine-generated ratios; run the command to reproduce or inspect `benchmarks/oracle-results.json`.

**What this does not establish:** those six instances do not represent a general performance guarantee, and there is no extrapolation to the 40-stop scenario. The exact optimiser and production planner share the same schematic travel-time model and constraints, so this is an internal mathematical benchmark, not an independent real-world routing study.

## B. Portable downloadable recovery certificate

After computing any plan, click **Download verified evidence** beside **Export current schedules**.

The self-contained JSON file includes the full synthetic input, selected assignments, uncovered stops, claimed statistics, current state version and a SHA-256 payload digest. `/api/certificate` separately validates the claim before returning the file. Independently check a downloaded certificate without launching the server:

```sh
node scripts/verify-certificate.js routerescue-recovery-certificate.json
```

It recalculates unique assignment, capacity, load, driver skills, route windows, shift ends, priority coverage and total schematic distance **using a validation module that does not call the production planner**.

A modified file is rejected by its hash, and even if someone manually recomputes that hash, fabricated routes are rejected by the constraint verifier. SHA-256 here provides change detection, **not cryptographic authorship or tamper-proof storage**. Anyone with filesystem access can rewrite the data and recalculate the hash. It also does not certify true road travel time, clinical urgency or real-world customer impact.

An example of the genuine output is in [`sample-recovery-certificate.json`](sample-recovery-certificate.json). To see that tampering is detected, change any field, save the file, and rerun the verifier.

## C. Full-scenario evidence

`node scripts/benchmark.js` compares a retained initial greedy baseline with the three-strategy planner over 16-stop and 40-stop synthetic fixtures. See [`BENCHMARK.md`](BENCHMARK.md) for timings and limitations. `npm run smoke` tests the actual MCP network path, approval boundaries, rollback, and complete and partial certificates.
