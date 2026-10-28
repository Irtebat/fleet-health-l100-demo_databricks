// Thin wrapper around fetch. Every call goes to the app's own server (/api/...).
import type { ChatMessage, Ticket, TicketInput } from '../../../shared/types';

export async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

// Builds "a=1&b=2", leaving out empty values.
export function toQuery(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  return query.toString();
}

export const api = {
  createTicket: (input: TicketInput) => request<Ticket>('POST', '/api/tickets', input),
  updateTicket: (id: number, patch: Partial<TicketInput>) =>
    request<Ticket>('PATCH', `/api/tickets/${id}`, patch),
  deleteTicket: (id: number) => request<void>('DELETE', `/api/tickets/${id}`),
  ask: (messages: ChatMessage[]) =>
    request<{ answer: string }>('POST', '/api/assistant', { messages }),
};
