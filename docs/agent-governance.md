# Agent governance — Unity Gateway

Model service: **`fleet_demo.ai.fleet_llm`**, a Unity Catalog securable deployed by the bundle (`resources/agent.yml`).

| Control | Configured in |
|---|---|
| Routing: Claude Sonnet 5.5, with Claude Haiku 5.5 as fallback | bundle |
| Rate limits: 60 req/min for the service; 20 req/min and 50K tokens/min per caller | bundle |
| Inference table: every request and response → `fleet_demo.ai.fleet_llm_payload` | bundle |
| Access: `EXECUTE` for `fleet_service_admins` and the agent service principal | bundle (`grants`) |
| Guardrails (service policies, Beta) | UI, see below |
| Budget | UI (account), see below |

## Guardrails (service policies — Beta)

1. Workspace admin: **Settings → Previews** → enable **Unity AI Gateway Service Policies**.
2. Open **AI Gateway → Services → `fleet_demo.ai.fleet_llm`** → **Policies** and attach:
   - `system.ai.block_unsafe_content`: blocks harmful requests and responses
   - `system.ai.block_jailbreak`: detects prompt injection and jailbreak attempts (input)
   - `system.ai.detect_sensitive_data`: redacts structured sensitive data (card numbers, IDs)

A blocked call returns **HTTP 200** with the policy message as the answer and a top-level
`databricks_service_policy` object. `src/agent/agent.py` appends it to the reply so it is visible to the caller.

## Budget

Account console (or Governance Hub → AI) → **Budgets → Create budget**:
- Resource type: **Unity Gateway**
- Shared monthly threshold, e.g. **$50** → *Send alert*
- Per-user threshold, e.g. **$5** → *Block usage*

Enforcement is near real time but approximate, not a hard cap. Budgets cover pay-per-token usage through
Unity Gateway, including the agent's calls and Genie.

## Observability

- **Usage:** `system.ai_gateway.usage`: tokens per caller and destination.
- **Payloads:** `SELECT * FROM fleet_demo.ai.fleet_llm_payload ORDER BY request_time DESC LIMIT 10`.
- **Traces:** MLflow experiment `fleet-agent`: each agent request with its LLM and tool spans.
- **Rate limit:** exceeding it returns HTTP 429.

## Agent identity — `fleet-agent-sp`

Model Serving's automatic credential passthrough doesn't cover UC model services yet, so the agent endpoint
authenticates as its own service principal (OAuth machine-to-machine):

| Item | Value |
|---|---|
| Service principal | `fleet-agent-sp` (application ID in bundle variable `agent_sp_application_id`) |
| OAuth secret | secret scope `fleet-agent-secrets`, key `client_secret`, injected as env var `{{secrets/fleet-agent-secrets/client_secret}}` |
| Entitlements | `workspace-access` (required to call Unity Gateway) and `databricks-sql-access`, set once by an admin |
| Grants | `EXECUTE` on the model service and `CAN_USE` on the warehouse (bundle); `USE CATALOG/SCHEMA`, `SELECT` on gold and `EXECUTE` on the tool functions (`src/agent/tools.sql`) |

A secret *scope* is used rather than a UC secret because Model Serving env vars resolve `{{secrets/<scope>/<key>}}` references.

Create or rotate the secret:
```bash
databricks service-principal-secrets-proxy create <sp-numeric-id> -o json \
  | python3 -c "import json,sys,subprocess; s=json.load(sys.stdin)['secret']; \
    subprocess.run(['databricks','secrets','put-secret','fleet-agent-secrets','client_secret','--string-value',s])"
# then redeploy or restart the endpoint so it picks up the new value
```

**ABAC applies to the agent.** `fleet-agent-sp` is not exempt from the `pii` mask, so the agent sees `****` for
customer names and phones. The agent can only see what its identity is allowed to see.
