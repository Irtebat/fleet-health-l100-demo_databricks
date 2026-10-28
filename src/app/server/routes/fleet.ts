import type { Application } from 'express';
import { z } from 'zod';
import { HEALTH_STATUSES } from '../../shared/types';
import { type Db, safely } from '../http';

// Reads the synced, read-only table serving.machine_health (Lakebase).
// Filters are optional and passed as query parameters ($1, $2), never concatenated into SQL.

const MachineFilters = z.object({
  region: z.string().trim().min(1).optional(),
  status: z.enum(HEALTH_STATUSES).optional(),
});

const LIST_MACHINES_SQL = `
  SELECT machine_id, model, region, customer_name,
         engine_hours::float8 AS engine_hours,
         last_hydraulic_temp_c::float8 AS last_hydraulic_temp_c,
         last_fuel_pct::float8 AS last_fuel_pct,
         fault_count::int AS fault_count,
         health_status,
         last_reading_at
  FROM serving.machine_health
  WHERE ($1::text IS NULL OR region = $1)
    AND ($2::text IS NULL OR health_status = $2)
  ORDER BY CASE health_status WHEN 'Critical' THEN 0 WHEN 'Watch' THEN 1 ELSE 2 END, machine_id
`;

const SUMMARY_SQL = `
  SELECT region, health_status, COUNT(*)::int AS n
  FROM serving.machine_health
  GROUP BY region, health_status
  ORDER BY region
`;

export function registerFleetRoutes(app: Application, db: Db) {
  app.get(
    '/api/fleet/machines',
    safely('Could not load machines', async (req, res) => {
      const filters = MachineFilters.safeParse(req.query);
      if (!filters.success) {
        res.status(400).json({ error: 'Invalid filter' });
        return;
      }
      const result = await db.query(LIST_MACHINES_SQL, [
        filters.data.region ?? null,
        filters.data.status ?? null,
      ]);
      res.json(result.rows);
    }),
  );

  app.get(
    '/api/fleet/summary',
    safely('Could not load fleet summary', async (_req, res) => {
      const result = await db.query(SUMMARY_SQL);
      res.json(result.rows);
    }),
  );
}
