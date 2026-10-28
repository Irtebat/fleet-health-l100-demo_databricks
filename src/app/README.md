# Fleet Service (Databricks App)

AppKit app (Node, Express, React) in the Ledger style. Deployed by `resources/app.yml` in the bundle.

**Structure**
- `server/server.ts`: wires the AppKit plugins (`lakebase`, `server`, `serving`) and registers the routes.
- `server/routes/fleet.ts`: Fleet view, reads the synced table `serving.machine_health`.
- `server/routes/tickets.ts`: Service tickets, CRUD on `app.service_tickets`. Creates the schema and table on startup.
- `server/routes/assistant.ts`: Assistant, calls the `fleet-agent` serving endpoint (MLflow ResponsesAgent).
- `shared/types.ts`: status values and row shapes shared by server and client.
- `client/src/pages/`: `FleetPage`, `TicketsPage`, `AssistantPage`. `components/kit.tsx` is the Ledger kit. `index.css` starts from the Ledger tokens.

**Databricks features**
- Fleet: Lakebase synced table (low-latency reads of UC gold data).
- Service tickets: an app-owned Lakebase table, so the app's service principal owns it.
- Assistant: a Model Serving endpoint (agent behind Unity Gateway).

**Commands**: `npm ci`, `npm run typecheck`, `npx eslint .`, `npm run build:server && npm run build:client`.
Do not run the app locally against the shared Lakebase: a local run creates `app` owned by your user, which breaks the app's ownership (see `POST_DEPLOY.md`)..
