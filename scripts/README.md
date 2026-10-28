# RDS PostgreSQL setup (operational "fleet" database)

The demo's operational source: a small public PostgreSQL on AWS RDS, read by the
Lakeflow Connect query-based PostgreSQL connector.

> Demo only: the instance is public. Port 5432 is allow-listed to your laptop IP and to the
> Databricks-published outbound IPs for us-east-2 (`ip-ranges.json`). `0.0.0.0/0` is not an option:
> the sandbox's Cloud Custodian guardrail removes it within seconds. Use strong passwords and delete it afterwards.

## Prerequisites
- AWS CLI v2, logged in to the sandbox profile:
  ```bash
  aws sso login --profile aws-sandbox-field-eng_databricks-sandbox-admin
  ```
- `psql` client (macOS: `brew install libpq && brew link --force libpq`)
- Two passwords:
  - `DB_PASSWORD` — admin user `fleet_admin`
  - `LFC_PASSWORD` — read-only user `lfc_reader` (used by the Lakeflow Connect connection)

## 1. Create the instance (~5–10 min)
```bash
export DB_PASSWORD='<admin-password>'
./scripts/rds_create.sh
```
Creates, in `us-east-2` (same region as the workspace):
- security group `fleet-db-sg` (TCP 5432 from your laptop IP + Databricks us-east-2 outbound IPs, via `rds_allow_ips.sh`)
- RDS instance `fleet-db` — PostgreSQL, `db.t4g.micro`, 20 GB gp3, public, no backups, single-AZ
- AWS tags: `project=fleet-l100`, `customer=demo-customer`, `env=demo`, `owner=<your-name>`

The script prints the endpoint at the end. Save it:
```bash
export DB_HOST=
```

If your laptop IP changes (VPN, new network) and psql times out, re-run:
```bash
./scripts/rds_allow_ips.sh
```

## 2. Seed the data
```bash
export LFC_PASSWORD='<connector-password>'
psql "host=$DB_HOST dbname=fleetdb user=fleet_admin password=$DB_PASSWORD sslmode=require" \
  -v lfc_password="$LFC_PASSWORD" -f scripts/rds_seed.sql
```
Creates schema `fleet` with:
- `customers` (10 rows) and `machines` (50 rows across North/West/South/East)
- an `updated_at` column on both, kept current by a trigger and indexed — the connector's cursor
- read-only user `lfc_reader`

Expected output at the end: machine count per region (~12–13 each).

## 3. Verify
```bash
# as the connector user — confirms network access and grants
psql "host=$DB_HOST dbname=fleetdb user=lfc_reader password=$LFC_PASSWORD sslmode=require" \
  -c "SELECT count(*) FROM fleet.machines;"
```
Expected: `50`.

Keep `DB_HOST` and `LFC_PASSWORD`: the host goes into the bundle variable `rds_host`, the password into a UC secret (see the main README).

## 4. Change the source data
```bash
psql "host=$DB_HOST dbname=fleetdb user=fleet_admin password=$DB_PASSWORD sslmode=require" \
  -f scripts/rds_change.sql
```
Adds customer 11, moves `EX-007` to it in the West region, and updates one phone number.
Re-run the job and follow the change through bronze → gold → dashboard → Lakebase → app.
`scripts/rds_reset.sql` reverts it.

## 5. Clean up (after the demo)
```bash
./scripts/rds_delete.sh
```
Deletes the instance (no final snapshot) and the security group.
