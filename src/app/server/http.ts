import type { Request, Response } from 'express';

// Wraps a route so that unexpected errors become a clean JSON 500 instead of a crash.
export function safely(
  failMessage: string,
  handler: (req: Request, res: Response) => Promise<void>,
) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error(failMessage, err);
      res.status(500).json({ error: failMessage });
    }
  };
}

// Lakebase handle as the app uses it (structural, so it matches appkit.lakebase).
export interface Db {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}
