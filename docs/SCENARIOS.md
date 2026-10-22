# Scenario specification and mathematical truthfulness

## Two reproducible fixtures

The small demo has 16 fictional deliveries and four volunteers. The full Incident Lab has 40 deliveries, eight volunteers with eight-stop capacity each, explicit shift bounds, per-stop service times and priority tags. All names and addresses are invented and travel estimates use Manhattan-like synthetic coordinates, not a road network.

## Invariants

For every candidate strategy, an independent verifier checks:

1. Every original stop appears **exactly once**, either assigned or explicitly uncovered.
2. Unavailable drivers are assigned zero stops.
3. Every driver's stop count and parcel load respect capacity.
4. The first service time at each stop is inside its delivery window, accounting for preceding travel, wait and service.
5. Every driver returns to the depot within their shift, and required driver skills are present where needed.
6. No plan is committed without an exact proposal signature, matching state version and nonexpired coordinator-issued approval token.

## Multi-objective optimisation

Three policies use deterministic multistart insertion, bounded ejection-chain repair, cross-route relocation and independent post-verification. The primary ranking favours covering priority stops and then total coverage, with strategy-specific soft objectives for distance and driver workload dispersion. A bounded heuristic is **not** an exact solver; a failure to cover every stop does not generally prove infeasibility.

## What we can prove when capacity collapses

With four of eight drivers unavailable, maximum remaining stop capacity is `4 × 8 = 32`, but there are 40 stops. At least `40 − 32 = 8` stops must remain uncovered without adding a driver or changing capacity. The scenario displays eight unassigned stops, avoids all time-window and shift violations, and refuses commitment.

## Human authorisation

The user must inspect a selected alternative. The local coordinator UI generates a one-time 256-bit random token, stores only its SHA-256 digest, and binds it to a proposal hash, version and expiration. The MCP commit tool requires the correct token. A strategy switch invalidates unused permission. Rollback requires a fresh separate token and restores all drivers and routes, not merely a few toggles. These are intended as **local simulator** safeguards, not authenticated online identity.
