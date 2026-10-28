-- Silver: typed and validated telemetry.
-- Expectations are data quality rules; results show up in the pipeline UI and event log.

CREATE OR REFRESH STREAMING TABLE silver.telemetry_clean (
  CONSTRAINT valid_machine_id EXPECT (machine_id IS NOT NULL) ON VIOLATION DROP ROW,  -- drop bad rows
  CONSTRAINT plausible_temp   EXPECT (hydraulic_temp_c BETWEEN 0 AND 150)             -- warn only
)
COMMENT 'Excavator telemetry with proper types and data quality checks'
AS SELECT
  machine_id,
  CAST(event_ts AS TIMESTAMP)        AS event_ts,
  CAST(engine_hours AS DOUBLE)       AS engine_hours,
  CAST(hydraulic_temp_c AS DOUBLE)   AS hydraulic_temp_c,
  CAST(fuel_pct AS DOUBLE)           AS fuel_pct,
  fault_code
FROM STREAM(bronze.telemetry_raw);
