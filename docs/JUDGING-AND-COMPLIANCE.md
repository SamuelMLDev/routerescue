# Official Hackathon Compliance Matrix

**Primary track:** Alexa+ · **Approach:** self-hosted Model Context Protocol server plus a web-based simulated voice/agent interface.

| Official requirement / judging criterion | Concrete implementation or submission item | Status |
|---|---|---|
| MCP protocol spec 2025-11-25 or later, Streamable HTTP | `server/mcp.js`, JSON-RPC `initialize`, `tools/list`, `tools/call`, protocol/version negotiation, read/write tool annotations | Implemented; local network smoke test |
| Actual runtime required-technology use | `server/index.js` calls `mcpClientInit` and `mcpClientCall` over HTTP; tracing displayed in the copilot | Implemented |
| Working demonstration | 16-stop dispatch and 40-stop cascading-failure lab; approval, rollback and digital twin; no credentials required | Implemented locally |
| Technical Implementation (25%) | Constraint search; external SciPy HiGHS exact reference; independent certificate checking; version-bound approval and rollback; fault and adversarial testing | Implemented, with documented model/scale limits |
| Design (25%) | Purpose-built dispatch workspace, Recovery Theatre, Resilience Lab and Evidence Centre; responsive screen styles and keyboard focus states | Implemented; desktop and mobile Evidence Centre captured from the bundled page/data fixture; browser networking to localhost was blocked |
| Potential Impact (25%) | Specific coordinator recovery flow with clear outcomes (coverage, windows, workload, intervention slots) and explicit user approval | Demonstrated on synthetic scenarios |
| Quality of the Idea (25%) | System recommends smallest relief intervention using mathematical lower bounds and validated recovery routes; can evaluate counterfactual capacity before changing live state | Implemented and repeatable |
| English public YouTube/Vimeo demo under 3 minutes | `submission/video-script.md` storyboard, recording of live functionality required | To record/upload |
| Complete public open-source GitHub repo or accessible private repo | `README.md`, Node scripts, local seed assets, licence | To publish/share |
| Written description and development feedback | `submission/devpost-submission.md`, product feedback and Q&A | Draft, review before submission |
| Original work and credited third-party assets | `LICENSE` and `THIRD_PARTY_CREDITS.md` | Packaged |
| App free to evaluate | No mandatory keys or dependencies beyond Node.js | Ready for local judging; hosted URL not provisioned |
| Extra AWS Builder mini-prize | Requires qualifying AWS integration | Not claimed |
| Extra Open Source mini-prize | Requires a separate contribution with URL | Not claimed |

Source: https://amazonappdev2026.devpost.com/rules and https://amazonappdev2026.devpost.com/details/faqs (rechecked 22 October 2026).

**Competition status:** the repository package alone is not a finished Devpost submission. The project must be uploaded to GitHub, the video recorded and published, and submission fields completed. Do not describe this as a production Alexa+ integration; Amazon's FAQ explicitly allows a self-hosted MCP + custom simulator path.
