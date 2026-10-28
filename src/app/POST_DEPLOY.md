# Post-deploy steps: Fleet Service app

Run these after the first deploy. Profile: `ir-demo`.

## 1. Deploy and start the app
Deploy the bundle, then deploy the app code (`bundle run fleet_app` builds and starts it):
```bash
databricks bundle deploy -p ir-demo
databricks bundle run fleet_app -p ir-demo
databricks apps get fleet-app -p ir-demo -o json   # state RUNNING, note service_principal_client_id
```

## 2. Grant the app read access to the synced machine table
The Fleet view reads `serving.machine_health`. The synced table is owned by the project owner, so the app's service principal needs an explicit grant. Replace `<SP_CLIENT_ID>` with `service_principal_client_id` from step 1:
```bash
databricks psql --project fleet-health -p ir-demo -- \
  -c 'GRANT USAGE ON SCHEMA serving TO "<SP_CLIENT_ID>";' \
  -c 'GRANT SELECT ON serving.machine_health TO "<SP_CLIENT_ID>";'
```
Check the grant again after any re-sync of the table.

## 3. Check the app
- Logs: `databricks apps logs fleet-app -p ir-demo --follow` (needs OAuth auth). Expect `[tickets] app.service_tickets is ready`.
- Open the app URL. Fleet should list 50 machines. Create, edit and delete a ticket. Ask the assistant a question (answers take 10 to 40 seconds).
- Confirm `app.service_tickets` exists: `databricks psql --project fleet-health -p ir-demo -- -c '\dt app.*'`.

## Do not
- Do not run the app locally against this Lakebase branch before the first deploy. The first local start creates the `app` schema and table as your user. The app's service principal then cannot manage them. If that happens, drop the `app` schema (this deletes its data) and redeploy so the service principal recreates it.
