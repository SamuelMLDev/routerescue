# Alexa+ track / Model Context Protocol integration

**Endpoint:** `http://127.0.0.1:4173/mcp`

**Protocol:** `2025-11-25`, stateless Streamable HTTP in JSON-response mode. POST accepts JSON-RPC requests and notifications; GET and DELETE return 405 because this server does not offer server-push SSE or sessions. Local mode validates the Origin header and binds to loopback by default. Do **not** publicly expose this demo without HTTPS and authentication.

## Handshake

```powershell
$h = @{ "Accept" = "application/json, text/event-stream"; "Content-Type" = "application/json"; "MCP-Protocol-Version" = "2025-11-25" }
$initialize = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"reviewer","version":"1.0"}}}'
Invoke-RestMethod -Uri http://127.0.0.1:4173/mcp -Method POST -Headers $h -Body $initialize
$ready = '{"jsonrpc":"2.0","method":"notifications/initialized"}'
Invoke-WebRequest -Uri http://127.0.0.1:4173/mcp -Method POST -Headers $h -Body $ready
$discover = '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
Invoke-RestMethod -Uri http://127.0.0.1:4173/mcp -Method POST -Headers $h -Body $discover
```

The initialized notification acknowledges with `202 Accepted` and no response body.

## Twelve tools

| Tool | Action | Safety |
|---|---|---|
| `get_dispatch_state` | Retrieve versioned current delivery state | Read only |
| `assess_disruption` | Inspect a named driver's affected deliveries | Read only |
| `set_driver_status` | Mark a fictional driver available/unavailable | Pre-commit state only; invalidates old proposals |
| `propose_rescue` | Recover a single cancellation and prepare three plans | No commit |
| `plan_incident_recovery` | Recover all active incidents and prepare three plans | No commit |
| `select_recovery_strategy` | Choose distance, balanced or priority at expected version | No commit, version check |
| `commit_rescue` | Commit exact selected proposal | Requires single-use human approval token |
| `undo_rescue` | Restore original pre-incident assignments | Requires separate single-use human rollback token |
| `verify_audit` | Validate sequential SHA-256 event hashes | Read only |
| `set_driver_shift` | Update an explicitly instructed volunteer shift cutoff | Invalidates proposals, never commits |
| `simulate_what_if` | Compute and independently check a read-only digital twin in a Node worker | Read only; no state effects |
| `assess_single_failure_resilience` | Rank reproducible single-volunteer outage consequences | Read only; not predictive |

`/api/approval` and `/api/rollback-approval` exist solely in the **local browser coordinator UI**, not as MCP tools. The app calls those endpoints only when a user clicks the corresponding action. Token hashes are never sent with state responses. The MCP agent cannot mint an approval by calling another MCP tool. Note this is a **local demonstration trust model**, not a substitute for production login.

Example discovery: `tools/list` exposes JSON Schemas and descriptive hints. Tool responses include `content` and `structuredContent`. Invalid tool requests return JSON-RPC errors or `isError` tool results; prompts cannot override server-side constraints.

## Stateful dialogue without fabricated AI

The optional operations copilot parses a small supported command grammar and carries context from the persisted dispatch state. E.g., "Sam is out" → MCP `set_driver_status` → MCP `plan_incident_recovery`; then "Priya is sick too, balance the workload" → update state → recompute → select balanced strategy. `server/agent.js` is a deterministic intent interpreter, **not an LLM**. It can also split a compound instruction such as “Sam is out, Priya can only stay until 12 PM; protect priorities” into several genuine MCP calls, and interpret bounded “what if” queries without mutating the live dispatch. It refuses "approve now" commands and leaves approval to the browser UI.

## Evidence and counterfactual promotion

`POST /api/twin` calls the read-only `simulate_what_if` MCP tool, and `POST /api/resilience` calls `assess_single_failure_resilience`. Both computations use isolated Node worker threads, respect source-state versions and cannot write live assignments. `POST /api/twin/evidence` exports a standalone certificate for offline verification. The coordinator-only `POST /api/twin/stage` requires explicit acknowledgement and a matching version to promote confirmed factual changes. It rejects unagreed delivery-window extensions and duplicate relief capacity; it recomputes proposed routes but **never approves or commits**. A human must separately select and authorise the exact new proposal.

## Production gaps

A real Alexa+ deployment would need remote HTTPS access, actual user identity, tenant isolation, secure server-to-server authentication and registration of the MCP service. No gated Alexa+ developer SDK or device was used. No real resident information is present.
