-- Agent tools: Unity Catalog SQL functions over gold.
-- Governed like any UC object (EXECUTE grants, lineage, audit). Safe to re-run.

CREATE OR REPLACE FUNCTION fleet_demo.ai.get_machine_health(id STRING COMMENT 'Machine ID, e.g. EX-007')
RETURNS TABLE (
  machine_id STRING, model STRING, region STRING, dealer STRING, customer_name STRING,
  health_status STRING, last_hydraulic_temp_c DOUBLE, avg_hydraulic_temp_c DOUBLE,
  fault_count BIGINT, last_reading_at TIMESTAMP
)
COMMENT 'Latest condition of one excavator'
RETURN
  SELECT machine_id, model, region, dealer, customer_name, health_status,
         last_hydraulic_temp_c, avg_hydraulic_temp_c, fault_count, last_reading_at
  FROM fleet_demo.gold.machine_health
  WHERE machine_id = id;

CREATE OR REPLACE FUNCTION fleet_demo.ai.list_machines_needing_attention(
  region_name STRING DEFAULT NULL COMMENT 'Optional region: North, South, East or West'
)
RETURNS TABLE (
  machine_id STRING, health_status STRING, region STRING, dealer STRING,
  last_hydraulic_temp_c DOUBLE, fault_count BIGINT
)
COMMENT 'Machines in Critical or Watch condition, most urgent first'
RETURN
  SELECT machine_id, health_status, region, dealer, last_hydraulic_temp_c, fault_count
  FROM fleet_demo.gold.machine_health
  WHERE health_status IN ('Critical', 'Watch')
    AND (region_name IS NULL OR region = region_name)
  ORDER BY CASE health_status WHEN 'Critical' THEN 1 ELSE 2 END, last_hydraulic_temp_c DESC;

-- The agent endpoint's identity (fleet-agent-sp) may run the tools and read gold.
-- It is NOT exempt from ABAC: customer names/phones are masked for the agent.
GRANT USE CATALOG ON CATALOG fleet_demo TO `0e97c97a-0f1d-4353-a5ad-e7215b129534`;
GRANT USE SCHEMA ON SCHEMA fleet_demo.ai TO `0e97c97a-0f1d-4353-a5ad-e7215b129534`;
GRANT USE SCHEMA, SELECT ON SCHEMA fleet_demo.gold TO `0e97c97a-0f1d-4353-a5ad-e7215b129534`;
GRANT EXECUTE ON FUNCTION fleet_demo.ai.get_machine_health TO `0e97c97a-0f1d-4353-a5ad-e7215b129534`;
GRANT EXECUTE ON FUNCTION fleet_demo.ai.list_machines_needing_attention TO `0e97c97a-0f1d-4353-a5ad-e7215b129534`;
