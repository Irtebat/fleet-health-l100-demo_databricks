-- ABAC for the fleet demo. Safe to re-run (runs as the apply_abac job task).
--   1. Tag columns          → describe WHAT the data is
--   2. Masking/filter UDFs  → HOW to protect it
--   3. Catalog-level policies → WHO is affected; applies to every table in bronze, silver and gold
--   4. Grants for the demo groups

-- 1. Column tags. Reuses existing account-wide governed tags `pii` and `geo_dimension`
--    (the account's governed-tag quota is full). Our policies are catalog-scoped, so only
--    tagged columns inside fleet_demo are affected.
SET TAG ON COLUMN fleet_demo.bronze.customers.customer_name   pii = NAME;
SET TAG ON COLUMN fleet_demo.bronze.customers.phone           pii = PHONE;
SET TAG ON COLUMN fleet_demo.gold.machine_health.customer_name pii = NAME;
SET TAG ON COLUMN fleet_demo.gold.machine_health.phone        pii = PHONE;

SET TAG ON COLUMN fleet_demo.bronze.machines.region           geo_dimension = region;
SET TAG ON COLUMN fleet_demo.gold.machine_health.region       geo_dimension = region;
SET TAG ON COLUMN fleet_demo.gold.region_summary.region       geo_dimension = region;

-- 2. UDFs
CREATE OR REPLACE FUNCTION fleet_demo.governance.mask_pii(value STRING)
RETURNS STRING
COMMENT 'Hides personal data'
RETURN '****';

CREATE OR REPLACE FUNCTION fleet_demo.governance.north_only(region STRING)
RETURNS BOOLEAN
COMMENT 'Keeps only rows from the North region'
RETURN region = 'North';

-- 3. Policies, attached once at catalog level.
-- The pipeline owner is in EXCEPT so pipelines always build silver/gold from unmasked data.
CREATE OR REPLACE POLICY fleet_mask_pii
ON CATALOG fleet_demo
COMMENT 'Mask customer PII for everyone except service admins'
COLUMN MASK fleet_demo.governance.mask_pii
TO `account users`
EXCEPT `fleet_service_admins`, `<your-email@here>`
FOR TABLES
MATCH COLUMNS has_tag('pii') AS pii
ON COLUMN pii;

CREATE OR REPLACE POLICY fleet_north_only
ON CATALOG fleet_demo
COMMENT 'North dealers only see machines in the North region'
ROW FILTER fleet_demo.governance.north_only
TO `fleet_north_dealers`
EXCEPT `<your-email@here>`
FOR TABLES
MATCH COLUMNS has_tag_value('geo_dimension', 'region') AS region
USING COLUMNS (region);

-- 4. Grants: both demo groups can read every layer; ABAC decides what they actually see.
GRANT USE CATALOG ON CATALOG fleet_demo TO `fleet_north_dealers`;
GRANT USE CATALOG ON CATALOG fleet_demo TO `fleet_service_admins`;
GRANT USE SCHEMA, SELECT ON SCHEMA fleet_demo.bronze TO `fleet_north_dealers`;
GRANT USE SCHEMA, SELECT ON SCHEMA fleet_demo.silver TO `fleet_north_dealers`;
GRANT USE SCHEMA, SELECT ON SCHEMA fleet_demo.gold   TO `fleet_north_dealers`;
GRANT USE SCHEMA, SELECT ON SCHEMA fleet_demo.bronze TO `fleet_service_admins`;
GRANT USE SCHEMA, SELECT ON SCHEMA fleet_demo.silver TO `fleet_service_admins`;
GRANT USE SCHEMA, SELECT ON SCHEMA fleet_demo.gold   TO `fleet_service_admins`;
