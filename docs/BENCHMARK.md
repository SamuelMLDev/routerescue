# Reproducible RouteRescue benchmark

All data is synthetic, all runs are deterministic, and durations are indicative of this machine only. There is no independent real-world delivery dataset and no global-optimality guarantee.

## Earlier single-outage heuristic versus Incident Lab strategy on the same 16-stop fixture

| Driver unavailable | Earlier coverage | New distance coverage | Earlier route distance (km) | New route distance (km) | Earlier solver time | New three-policy time |
|---|---:|---:|---:|---:|---:|---:|
| sam | 16/16 | 16/16 | 36.1 | 36 | 16 ms | 204 ms |
| priya | 16/16 | 16/16 | 37.1 | 37.1 | 3 ms | 176 ms |
| leo | 16/16 | 16/16 | 37.1 | 37.1 | 1 ms | 148 ms |
| maya | 16/16 | 16/16 | 36.1 | 36.1 | 2 ms | 169 ms |

The timings measure different workloads: the earlier heuristic produces **one** plan; the new engine produces **three** alternatives and validates them. Faster time for the earlier solver is expected. These results do not establish that one algorithm is globally superior.

## Multi-incident reliability on the 40-stop Incident Lab fixture

| Unavailable drivers | Distance coverage | Balanced coverage | Priority coverage | Priority commitments covered | Three-policy total duration |
|---|---:|---:|---:|---:|---:|
| sam | 40/40 | 40/40 | 40/40 | 8/8 | 2583 ms |
| priya | 40/40 | 40/40 | 40/40 | 8/8 | 2424 ms |
| leo | 40/40 | 40/40 | 40/40 | 8/8 | 2483 ms |
| maya | 40/40 | 40/40 | 40/40 | 8/8 | 2157 ms |
| sam + priya | 40/40 | 40/40 | 40/40 | 8/8 | 1602 ms |
| sam + leo | 40/40 | 40/40 | 40/40 | 8/8 | 1661 ms |
| sam + priya + leo | 40/40 | 40/40 | 40/40 | 8/8 | 1344 ms |
| sam + priya + leo + maya | 32/40 | 32/40 | 32/40 | 8/8 | 1152 ms |

The four-driver outage has only 32 remaining driver-stop slots for 40 deliveries. All strategies report uncovered stops rather than claiming that an impossible complete assignment is feasible.

## Reproduce

```sh
node scripts/benchmark.js
```

The script writes `benchmarks/results.json` and this report. No network calls, keys or remote services are used.
