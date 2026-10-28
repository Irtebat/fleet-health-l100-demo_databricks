-- Gold: business-ready views for the dashboard, Genie, Lakebase and the agent.

-- One row per machine: latest condition + machine and customer details.
CREATE OR REFRESH MATERIALIZED VIEW gold.machine_health
COMMENT 'One row per excavator: latest condition, health status, owner and dealer'
AS
WITH readings AS (
  SELECT
    machine_id,
    max(event_ts)                         AS last_reading_at,
    max_by(hydraulic_temp_c, event_ts)    AS last_hydraulic_temp_c,
    max_by(fuel_pct, event_ts)            AS last_fuel_pct,
    max(engine_hours)                     AS engine_hours,
    round(avg(hydraulic_temp_c), 1)       AS avg_hydraulic_temp_c,
    count_if(fault_code IS NOT NULL)      AS fault_count
  FROM silver.telemetry_clean
  GROUP BY machine_id
)
SELECT
  m.machine_id,
  m.model,
  m.region,
  m.dealer,
  c.customer_name,
  c.phone,
  r.last_reading_at,
  r.last_hydraulic_temp_c,
  r.last_fuel_pct,
  r.engine_hours,
  r.avg_hydraulic_temp_c,
  r.fault_count,
  CASE
    WHEN r.last_hydraulic_temp_c > 95 THEN 'Critical'
    WHEN r.last_hydraulic_temp_c > 80 OR r.fault_count >= 2 THEN 'Watch'
    ELSE 'Healthy'
  END AS health_status
FROM bronze.machines m
LEFT JOIN readings r        ON m.machine_id = r.machine_id
LEFT JOIN bronze.customers c ON m.customer_id = c.customer_id;

-- One row per region: fleet health at a glance.
CREATE OR REFRESH MATERIALIZED VIEW gold.region_summary
COMMENT 'Fleet health per region'
AS SELECT
  region,
  count(*)                                                    AS machines,
  count_if(health_status = 'Healthy')                         AS healthy,
  count_if(health_status = 'Watch')                           AS watch,
  count_if(health_status = 'Critical')                        AS critical,
  round(100 * count_if(health_status = 'Healthy') / count(*), 1) AS pct_healthy,
  sum(fault_count)                                            AS total_faults
FROM gold.machine_health
GROUP BY region;
