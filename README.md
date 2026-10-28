# Fleet Health & Service on Databricks

An end-to-end demo of the Databricks Data Intelligence Platform on mock excavator data, deployed by one
Declarative Automation Bundle (DAB).

Telemetry files and machine/customer master data from an operational PostgreSQL database are ingested,
refined through a medallion pipeline and governed with Unity Catalog ABAC. Analysts use an AI/BI dashboard and
Genie. Service engineers use a Databricks App on Lakebase, with an AI assistant behind Unity Gateway.

```
Volume (JSON telemetry) ──Auto Loader──┐
                                       ├─> bronze ─> silver ─> gold ─┬─> AI/BI dashboard + Genie
RDS PostgreSQL ──Lakeflow Connect──────┘   (Lakeflow pipeline)       ├─> Lakebase (synced) ─> App
                                                                     └─> UC functions ─> Agent ─> App
              Unity Catalog: ABAC · lineage · Unity Gateway · usage policies
```

## What it shows

| Capability | Implementation |
|---|---|
| File ingestion | Auto Loader (`STREAM read_files`) on a UC volume: `src/pipeline/bronze.sql` |
| Database ingestion | Lakeflow Connect query-based PostgreSQL connector (serverless, `updated_at` cursor, SCD type 1): `resources/ingestion.yml` |
| Medallion pipeline | Lakeflow Spark Declarative Pipelines, with expectations for data quality: `src/pipeline/` |
| Orchestration | Lakeflow Job `fleet-e2e`: `resources/job.yml` |
| Governance | Governed tags and catalog-level ABAC policies (column mask on PII, row filter by region): `src/governance/abac.sql` |
| Lineage | Captured automatically by Unity Catalog, from the Postgres source to the app |
| BI | AI/BI dashboard (Fleet and Cost pages) and a Genie space: `resources/bi.yml` |
| Operational serving | Lakebase project, gold table synced to Postgres, registered in UC: `resources/lakebase.yml` |
| Governed LLM access | Unity Gateway model service: routing and fallback, rate limits, inference table, guardrails, budget: `resources/agent.yml`, `docs/agent-governance.md` |
| Agent | MLflow `ResponsesAgent` with UC function tools, on Model Serving: `src/agent/` |
| App | AppKit (Node + React): fleet view, service-ticket CRUD on Lakebase, assistant: `src/app/` |
| Cost attribution | Serverless usage policy, bundle tags and per-resource `component` tags |

## Data model (mock)

| Layer | Table | Notes |
|---|---|---|
| Source (volume) | `landing/telemetry/*.json` | machine_id, event_ts, engine_hours, hydraulic_temp_c, fuel_pct, fault_code |
| Source (RDS) | `fleet.machines`, `fleet.customers` | 50 machines in 4 regions, 10 customers |
| Bronze | `telemetry_raw`, `machines`, `customers` | Auto Loader and Lakeflow Connect landing |
| Silver | `telemetry_clean` | Typed and validated |
| Gold | `machine_health`, `region_summary` | Per-machine health status; per-region rollup |
| Lakebase | `serving.machine_health` (synced, read-only), `app.service_tickets` (app-owned, CRUD) | |

## Repository layout

```
databricks.yml        bundle: variables, target, bundle-wide tags
resources/            one file per area (foundation, ingestion, pipeline, job, BI, Lakebase, agent, app)
src/pipeline/         bronze / silver / gold SQL
src/data_gen/         telemetry generator notebook
src/setup/            creates the UC connection to RDS
src/governance/       ABAC tags, UDFs, policies, grants
src/dashboards/       AI/BI dashboard definition
src/genie/            Genie space definition
src/agent/            agent code, UC function tools, logging and registration
src/app/              AppKit app
scripts/              RDS create / seed / change / reset / delete
docs/                 agent governance setup (guardrails, budget, identity)
```

## Prerequisites

- Databricks workspace with Unity Catalog and serverless compute (AWS)
- Databricks CLI v0.294+ with a workspace profile (this repo uses `ir-demo`)
- AWS CLI and `psql` for the RDS source database
- Account-level groups `fleet_service_admins` (sees everything) and `fleet_north_dealers` (North region only,
  PII masked), each with at least one member. The PII mask also exempts the pipeline owner: update the
  `EXCEPT` lists in `src/governance/abac.sql` to your deploying user

## Setup

### 1. One-time workspace setup (UI)
1. **Catalog:** create catalog `fleet_demo`.
2. **Usage policy:** create a serverless usage policy (e.g. `fleet-demo`) with tags such as
   `project=fleet-l100`, `customer=demo-customer`, `env=demo`. Put its ID in `usage_policy_id` in `databricks.yml`.
3. **Agent service principal:** create `fleet-agent-sp`, grant it the `workspace-access` and `databricks-sql-access`
   entitlements, and put its application ID in `agent_sp_application_id`.
4. Update the workspace `profile` and `host` under `targets.dev` in `databricks.yml`.

### 2. Source database (AWS RDS)
Follow `scripts/README.md`: create the instance, seed it, and verify the read-only user `lfc_reader`.
Set the RDS endpoint as `rds_host` in `databricks.yml`.

### 3. Deploy the foundation and the RDS connection
```bash
databricks bundle deploy -p ir-demo
# Store the connector password as a UC secret (it never appears in code or config)
databricks secrets-uc create-secret rds_lfc_password fleet_demo secrets "$LFC_PASSWORD" -p ir-demo
databricks bundle run fleet_setup -p ir-demo     # creates UC connection fleet_rds
databricks bundle deploy -p ir-demo                # deploys the ingestion pipeline now that the connection exists
```
The first deploy may report that the ingestion pipeline can't be created yet. That's expected until the connection exists.
For lineage to the Postgres source, the pipeline owner needs `CREATE EXTERNAL METADATA` on the metastore.

### 4. Run the pipeline
```bash
databricks bundle run fleet_e2e -p ir-demo
```
Tasks: `generate_telemetry` and `ingest_rds` → `medallion` → `sync_lakebase` and `apply_abac`.
About 3 minutes in `PERFORMANCE_OPTIMIZED` mode; set `performance_target: STANDARD` for lower cost.

### 5. Agent
```bash
# Store the agent service principal's OAuth secret (see docs/agent-governance.md)
databricks bundle run fleet_agent_build -p ir-demo   # creates the UC tools, tests and registers the agent
databricks bundle deploy -p ir-demo                    # serving endpoint for the registered version
```
To serve a new version, update `agent_version` in `resources/agent.yml` and deploy.
Then attach the guardrails and create the budget in the UI (`docs/agent-governance.md`).

### 6. App
```bash
databricks bundle run fleet_app -p ir-demo             # builds and starts the app
```
Then grant the app read access to the synced table: see `src/app/POST_DEPLOY.md`.

### 7. Check
- **Dashboard and Genie:** Dashboards → *Fleet Health*; **Ask Genie** opens the linked space.
- **ABAC:** run `SELECT region, customer_name FROM fleet_demo.gold.machine_health` as a member of each group.
- **App:** open the `fleet-app` URL from Compute → Apps.

## Cost attribution

| Resource | Attribution |
|---|---|
| Jobs, pipelines, app | Serverless usage policy (`usage_policy_id`) and bundle tags; pipelines are also identified by `dlt_pipeline_id` |
| Model serving endpoint, Lakebase | `budget_policy_id` and `component` tags |
| SQL warehouse (dashboard, Genie, agent tools) | Dedicated warehouse `fleet-demo-wh` with `component=bi` |
| LLM tokens | Unity Gateway usage tracking and budget |

The dashboard's **Cost** page reads `system.billing.usage` grouped by these tags.

## Clean up
```bash
databricks bundle destroy -p ir-demo
./scripts/rds_delete.sh
```
Then delete the catalog, usage policy and service principals created in the UI.
