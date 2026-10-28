# Databricks notebook source
# MAGIC %md
# MAGIC # Generate mock excavator telemetry
# MAGIC Writes one JSON-lines file per run into the landing volume. Auto Loader picks up each new file.

# COMMAND ----------

import json
import random
from datetime import datetime, timedelta, timezone

dbutils.widgets.text("catalog", "fleet_demo")
catalog = dbutils.widgets.get("catalog")
landing_path = f"/Volumes/{catalog}/landing/telemetry"

MACHINES = [f"EX-{i:03d}" for i in range(1, 51)]
HOT_MACHINES = {"EX-007", "EX-023", "EX-041"}  # always run hot, so the demo has a consistent story
FAULT_CODES = ["HYD-OVERHEAT", "ENG-LOW-OIL", "FUEL-SENSOR"]

# COMMAND ----------

now = datetime.now(timezone.utc)
readings = []

for machine_id in MACHINES:
    hot = machine_id in HOT_MACHINES
    for minutes_ago in (45, 30, 15, 0):  # 4 readings per machine per run
        hydraulic_temp_c = round(random.uniform(88, 105) if hot else random.uniform(60, 82), 1)
        fault_code = None
        if hydraulic_temp_c > 95:
            fault_code = "HYD-OVERHEAT"
        elif random.random() < 0.03:
            fault_code = random.choice(FAULT_CODES)

        readings.append({
            "machine_id": machine_id,
            "event_ts": (now - timedelta(minutes=minutes_ago)).isoformat(),
            "engine_hours": round(1000 + int(machine_id[-3:]) * 120 + random.uniform(0, 5), 1),
            "hydraulic_temp_c": hydraulic_temp_c,
            "fuel_pct": round(random.uniform(10, 100), 1),
            "fault_code": fault_code,
        })

# Two bad readings per run, so the silver expectations have something to catch
readings.append({**readings[0], "machine_id": None})                             # dropped: valid_machine_id
readings.append({**readings[1], "machine_id": "EX-000", "hydraulic_temp_c": 999.0})  # warned: plausible_temp (unregistered test unit, not in gold)

# COMMAND ----------

file_path = f"{landing_path}/telemetry_{now.strftime('%Y%m%d_%H%M%S')}.json"
with open(file_path, "w") as f:
    f.write("\n".join(json.dumps(r) for r in readings))

print(f"Wrote {len(readings)} readings to {file_path}")
