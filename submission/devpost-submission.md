# RouteRescue Evidence Edition v5 — Devpost paste-ready submission

**Project title:** RouteRescue: Frontier

**Tagline:** The minimum safe change that keeps every doorstep covered. MCP-native operational resilience with independent mathematical verification.

**Two alternate titles/taglines:**
1. **Northbank Control Room** — See a volunteer dispatch collapse. Watch verified routes recover.
2. **Every Stop Counts** — An agent proposes; a human decides; every doorstep is accounted for.

**Primary track:** Alexa+ (self-hosted MCP 2025-11-25 server with a custom simulated experience; no claim of access to the gated Alexa+ preview tooling).

**Built with:** Node.js, JavaScript, CSS, SVG, JSON-RPC, Model Context Protocol / Streamable HTTP, SHA-256, optional model-assisted planning and optional road-network matrices.

## Inspiration

A cancelled volunteer shift isn't a simple calendar update when people are depending on deliveries. Real coordinators must consider which parcels are urgent, how much each driver can carry, when each recipient can receive a delivery, and how much additional work other volunteers can absorb. We wanted the power of an agent to be **verifiable**—not merely a confident-sounding recommendation.

## What it does

RouteRescue is a local-first decision centre for fictional community meal delivery. It begins with 40 stops across eight volunteers. A coordinator can remove a driver, trigger a cascading two-driver outage, or force a four-driver capacity crisis. The engine computes three genuine alternative schedules—shortest routes, fair workload and priority protection—and renders the original routes underneath the proposed replacements. The dispatcher can question the state-aware operations copilot in plain language; it calls real MCP tools to set incidents, plan routes and explain measurable constraints. A plan must be explicitly approved by the coordinator; exact plan signatures, state versions and single-use tokens are checked before any assignment changes. A one-click rollback restores the original schedule.

**Signature demo:** Click **Find minimum intervention** and the system itself enumerates backup capacities, rejects mathematically insufficient ones, and searches for a verified plan. In the new Resilience Lab, four drivers are marked hypothetically unavailable, leaving 32 stop slots for 40 obligations. The optimiser and verifier show 32 covered and eight necessarily uncovered. Adding the automatically discovered hypothetical relief driver with eight slots recovers all 40 in the tested fixture **without modifying the live operation**; the coordinator can then explicitly stage only confirmed facts and separately approve the exact recalculated proposal. In the Incident Lab, two volunteers cancel, their original stops become at risk, and three independently verified alternate solutions appear. Changing strategy changes the proposed routes and workload metrics. The team approves a reviewed plan, then intentionally worsens the scenario to just four available drivers. Since capacity is only 32 stop slots for 40 deliveries, RouteRescue explicitly reports eight uncovered deliveries and refuses to dispatch an impossible plan. The product does not make up successes.

## How we built it

We implemented a Node.js stateless MCP 2025-11-25 Streamable HTTP server with thirteen discoverable tools, JSON-RPC tool calls and input validation. A separate MCP client negotiates the protocol and invokes the tools over actual HTTP; the browser is a simulated Alexa+-style experience rather than an official gated tool. The default local deterministic interpreter retains operational context across turns such as “Sam is out,” “Priya is sick too,” “balance the workload,” and “why is this plan safe?”—without pretending a cloud LLM is present. An optional, genuinely hosted model planner proposes only validated **read-only MCP investigations**, while a no-key deterministic mode preserves the entire demo.

The hardest component is a custom deterministic recovery engine: multiple insertion orderings, bounded repair and route relocations, three weighted strategy objectives and an independent verifier for delivery uniqueness, priorities, availability, load, deadlines, skills and shift end. When capacity is provably below demand it displays the proof; when the bounded search fails in other circumstances, it does not claim infeasibility. To prevent hand-wavy accuracy claims, we added a small-instance exact oracle (24 reproducible cases) and a separate, externally solved 128-case SciPy HiGHS reference (mean distance gap 1.63%, worst 16.67%) and a downloadable self-contained recovery certificate that a separate offline checker validates without calling the solver. The UI is an original responsive incident control room with live SVG route changes, strategy comparison, an operational digital twin, MCP tool evidence and a checkable hash-linked decision log. Worker-isolated counterfactuals explore driver outages, hypothetical backup capacity and shortened shifts without touching the operational state. An independent verifier checks each alternative; a deterministic risk sweep evaluates every single-driver failure. Coordinators may explicitly confirm real-world scenario facts, stage them into the operational model and generate fresh proposals—but never silently commit a hypothetical plan. Proposals are never silently committed: approvals and rollbacks each require coordinator-side short-lived single-use tokens bound to specific state versions.

## Challenges we ran into

The official gated Alexa+ preview developer tools were not available to general participants, so we followed the explicitly supported self-hosted MCP path and built an original simulation. Real driving directions would require licensed geographic APIs or sensitive user data, so we chose transparent fictional geometry and explicitly labelled it. We also had to defend against an agent mutating a proposal after it had been reviewed, which led to our exact version/signature approval gate and full-state rollback. Building independent hard-constraint checks and handling a physically impossible recovery case were more important than adding a superficial generative interface.

## Accomplishments we're proud of

- A working MCP server with thirteen discoverable tools and real JSON-RPC network client, not a decorative MCP label.
- A minimum-intervention discovery engine that proves an eight-stop capacity lower bound and automatically discovers a verified eight-stop rescue.
- A read-only operational digital twin with a live, independently verified capacity-impossibility explanation and real what-if recovery strategies.
- Explicit staging of confirmed scenario assumptions; additional approval required for exact recovery assignment, stale state and unagreed deadlines rejected.
- Proactive single-driver stress ranking and versioned forensic state checkpoints.
- Three meaningfully different, directly comparable recovery policies for a 40-stop scenario, all independently verified.
- An agent that takes contextual multi-turn instructions through actual MCP tools but **cannot approve its own plan**.
- A four-driver capacity crisis that displays 32/40 assignments and blocks unsafe approval rather than falsely claiming success.
- Version-bound, one-time coordinator authorisation and a complete state rollback with hash-linked audit events.
- a broad algorithm, protocol and adversarial test suite; 82 curated offline agent-intent inputs; 128 external HiGHS reference problems; 240 earlier synthetic fault/property scenarios; a fresh-process HTTP smoke test; portable independently verified recovery certificates; and 24 reproducible exact-oracle microbenchmarks.
- A visually distinctive mobile-to-desktop operations product with no external package downloads or API keys.

## What we learned

Useful agents need a firm boundary between language understanding, decision algorithms, human authority and truth about uncertainty. A stylish route animation is meaningful only if all underlying deliveries are accounted for and the result can be reproduced. MCP's discoverable tool model makes those boundaries explicit, and a proper simulation must surface technical limitations—not conceal them.

## What's next

Licensed road-time matrices, durable transactional storage, multi-organisation isolation, secure hosted MCP, durable audit anchoring and larger published routing benchmarks are realistic follow-on engineering priorities. These production services are not claimed for this local synthetic demonstration.

## Links — submitter fills in

- Public repository: **[ADD YOUR GITHUB REPO URL]**
- Video under 3 minutes, public YouTube/Vimeo: **[ADD YOUR VIDEO URL]**
- Live online instance, if deployed: **[ADD OPTIONAL URL]**
- Team / developer(s): **[ADD REAL NAMES]**

## Mandatory product feedback (edit to match your own experience)

**What was used:** The public Model Context Protocol 2025-11-25 specification, specifically stateless Streamable HTTP, tool schemas, capability negotiation and JSON-RPC. We used built-in Node.js HTTP and crypto modules. We did **not** use Amazon's preview Alexa+ Add-on SDK or AWS cloud services. The optional model API adapter was tested with a local protocol-compatible provider rather than external credentials.

**What worked:** The public MCP design made it straightforward to keep read-only assessment and non-committing planning separate from committing changes. The official hackathon FAQ clarifies that a custom simulator plus self-hosted MCP server is an acceptable development path without preview-tool access.

**Where documentation could improve:** Developers would benefit from one complete, beginner-accessible self-hosted Alexa+ hackathon reference that combines the correct MCP transport headers, `initialize` / `notifications/initialized` lifecycle, security expectations, custom simulator integration and guidance on testing the live endpoint. This is a documentation request, not an allegation of a defect in a gated SDK we never accessed.

**Onboarding flow:** We built the network handshake and tool list, then implemented isolated read/plan/write tools, followed by the domain solver and browser operations simulation. We independently exercised the HTTP endpoint with schema-invalid requests and an Origin-blocking case.

**Would we use the technology again?** Yes, for consent-based, bounded business workflows where the model or interpreter can discover tools but cannot bypass the coordinator's final authority. Production identity and HTTP security would need to be added before a public deployment.

## Optional friction and feature feedback — do not fabricate

**Feature request / important:** A public sample repository showing a complete, non-gated Alexa+ MCP simulator with correct approval gates and deployment security, distinct from restricted preview add-on tools. Verify all actual friction log entries against your own development experience; no fabricated stack traces, SDK bugs or issue IDs are provided here.
