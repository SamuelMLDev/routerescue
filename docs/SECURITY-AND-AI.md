# Identity, safe decisions and optional model planner

## Offline mode (default)

Run without `.env`: the fictional simulator is deliberately open on `127.0.0.1` for a two-click judge demo. This is not authentication. It should not be published on an open network in this mode.

## Optional authenticated coordinator sessions

Set `ROUTERESCUE_USERS_JSON` as an environment variable mapping 2–20 safe usernames to passwords of at least 12 characters. Example (use **different, secret** values for actual use):

```powershell
$env:ROUTERESCUE_USERS_JSON = '{"alex":"ReplaceWithLongSecret123!","pat":"ReplaceWithAnotherLongSecret123!"}'
node server/index.js
```

The browser then displays a credential form. Passwords are compared against memory-only scrypt hashes; sessions are random and server-side, expire after two hours, and use HttpOnly / SameSite=Strict cookies. Mutating MCP tools are restricted to the server-internal gateway; external MCP readers can still be listed by an authenticated coordinator. Browser-origin approvals and rollbacks are bound to the authenticated requesting coordinator, and exact state/proposal versions continue to be checked. Run `npm run auth-smoke` to verify two sessions and cross-user replay denial.

This is a locally scoped demonstrator, **not** an enterprise security certification. It lacks persistent user administration, multiple roles, server-side TLS termination, external audit anchoring, SSO and real multi-process database transactions. An authenticated remote deployment requires a proper security review.

## Optional model-orchestrated investigation

To use a real hosted model, set `AI_API_KEY`, `AI_MODEL`, and optionally `AI_ENDPOINT` (defaults to an OpenAI-compatible Chat Completions endpoint). The app sends **only fictional** roster metadata plus the user's prompt. Never send personal delivery recipient data without a privacy/legal review. AI features may incur provider charges; demo mode requires no account.

The model returns structured JSON actions, not schedules. `server/ai-agent.js` validates tool IDs, driver IDs, policies, capacities, and a three-action limit. Its **entire allowlist** is read-only: `find_minimum_intervention`, `simulate_what_if`, and `assess_single_failure_resilience`. The gateway then makes actual MCP calls and constructs a deterministic, grounded response from the tool results. Destructive instructions or invalid model outputs cannot bypass approvals. The optional model path has been tested with a mock compatible response, not a live paid provider.

When the provider is unavailable or no credentials are set, deterministic offline interpretation continues. Server-side approval tokens are not included in prompts, model replies or tool schemas. The model cannot call the browser-only approval exchange.
