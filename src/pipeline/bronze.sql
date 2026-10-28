-- Bronze: excavator telemetry, ingested incrementally with Auto Loader.
-- STREAM read_files(...) = Auto Loader: each run picks up only new files in the volume.

CREATE OR REFRESH STREAMING TABLE telemetry_raw
COMMENT 'Raw excavator telemetry from the landing volume (Auto Loader)'
AS SELECT
  *,
  _metadata.file_path AS source_file,
  current_timestamp() AS ingested_at
FROM STREAM read_files('/Volumes/${catalog}/landing/telemetry', format => 'json');
