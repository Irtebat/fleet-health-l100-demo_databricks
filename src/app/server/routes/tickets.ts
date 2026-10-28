import type { Application } from 'express';
import { z } from 'zod';
import { PRIORITIES, TICKET_STATUSES } from '../../shared/types';
import { type Db, safely } from '../http';

// Service tickets are app-owned: the app creates schema "app" and its table on startup,
// so the app's service principal owns them (no manual grants needed).

const SETUP_SQL = [
  'CREATE SCHEMA IF NOT EXISTS app',
  `CREATE TABLE IF NOT EXISTS app.service_tickets (
     id SERIAL PRIMARY KEY,
     machine_id TEXT NOT NULL,
     title TEXT NOT NULL,
     priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
     status TEXT NOT NULL CHECK (status IN ('Open', 'In progress', 'Closed')),
     notes TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
];

const COLUMNS = 'id, machine_id, title, priority, status, notes, created_at, updated_at';

const TicketBody = z.object({
  machine_id: z.string().trim().min(1, 'Machine is required').max(32),
  title: z.string().trim().min(1, 'Title is required').max(200),
  priority: z.enum(PRIORITIES),
  status: z.enum(TICKET_STATUSES),
  notes: z.string().max(2000),
});

const TicketPatch = TicketBody.partial().refine((body) => Object.keys(body).length > 0, {
  message: 'Nothing to update',
});

const TicketId = z.string().regex(/^\d+$/, 'Invalid ticket id').transform(Number);

export async function ensureTicketsTable(db: Db) {
  for (const statement of SETUP_SQL) {
    await db.query(statement);
  }
  console.log('[tickets] app.service_tickets is ready');
}

export function registerTicketRoutes(app: Application, db: Db) {
  app.get(
    '/api/tickets',
    safely('Could not load tickets', async (_req, res) => {
      const result = await db.query(`SELECT ${COLUMNS} FROM app.service_tickets ORDER BY id DESC`);
      res.json(result.rows);
    }),
  );

  app.post(
    '/api/tickets',
    safely('Could not create ticket', async (req, res) => {
      const body = TicketBody.safeParse(req.body);
      if (!body.success) {
        res.status(400).json({ error: body.error.issues[0]?.message ?? 'Invalid ticket' });
        return;
      }
      const { machine_id, title, priority, status, notes } = body.data;
      const result = await db.query(
        `INSERT INTO app.service_tickets (machine_id, title, priority, status, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${COLUMNS}`,
        [machine_id, title, priority, status, notes],
      );
      res.status(201).json(result.rows[0]);
    }),
  );

  // Only the fields sent are changed; missing fields keep their current value (COALESCE).
  app.patch(
    '/api/tickets/:id',
    safely('Could not update ticket', async (req, res) => {
      const id = TicketId.safeParse(req.params.id);
      if (!id.success) {
        res.status(400).json({ error: id.error.issues[0]?.message ?? 'Invalid ticket id' });
        return;
      }
      const body = TicketPatch.safeParse(req.body);
      if (!body.success) {
        res.status(400).json({ error: body.error.issues[0]?.message ?? 'Invalid ticket' });
        return;
      }
      const result = await db.query(
        `UPDATE app.service_tickets SET
           machine_id = COALESCE($2, machine_id),
           title = COALESCE($3, title),
           priority = COALESCE($4, priority),
           status = COALESCE($5, status),
           notes = COALESCE($6, notes),
           updated_at = now()
         WHERE id = $1
         RETURNING ${COLUMNS}`,
        [
          id.data,
          body.data.machine_id ?? null,
          body.data.title ?? null,
          body.data.priority ?? null,
          body.data.status ?? null,
          body.data.notes ?? null,
        ],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Ticket not found' });
        return;
      }
      res.json(result.rows[0]);
    }),
  );

  app.delete(
    '/api/tickets/:id',
    safely('Could not delete ticket', async (req, res) => {
      const id = TicketId.safeParse(req.params.id);
      if (!id.success) {
        res.status(400).json({ error: id.error.issues[0]?.message ?? 'Invalid ticket id' });
        return;
      }
      const result = await db.query('DELETE FROM app.service_tickets WHERE id = $1 RETURNING id', [
        id.data,
      ]);
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Ticket not found' });
        return;
      }
      res.status(204).send();
    }),
  );
}
