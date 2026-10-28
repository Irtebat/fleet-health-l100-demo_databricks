// One place that maps app statuses to Ledger pill tones.
import type { HealthStatus, Priority, TicketStatus } from '../../../shared/types';

export type Tone = 'green' | 'blue' | 'amber' | 'red' | 'brand' | 'neutral' | 'muted';

export const healthTone: Record<HealthStatus, Tone> = {
  Healthy: 'green',
  Watch: 'amber',
  Critical: 'red',
};

export const ticketStatusTone: Record<TicketStatus, Tone> = {
  Open: 'amber',
  'In progress': 'blue',
  Closed: 'green',
};

export const priorityTone: Record<Priority, Tone> = {
  High: 'red',
  Medium: 'amber',
  Low: 'muted',
};
