// Shared between server and client: the allowed values and the row shapes the API returns.

export const HEALTH_STATUSES = ['Healthy', 'Watch', 'Critical'] as const;
export const PRIORITIES = ['Low', 'Medium', 'High'] as const;
export const TICKET_STATUSES = ['Open', 'In progress', 'Closed'] as const;

export type HealthStatus = (typeof HEALTH_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

// One row of serving.machine_health (synced from UC gold.machine_health).
// The customer phone number is deliberately not selected or shown.
export interface Machine {
  machine_id: string;
  model: string;
  region: string;
  customer_name: string;
  engine_hours: number;
  last_hydraulic_temp_c: number;
  last_fuel_pct: number;
  fault_count: number;
  health_status: HealthStatus;
  last_reading_at: string;
}

// Count of machines per region and health status (used for filter counts and KPIs).
export interface FleetSummaryRow {
  region: string;
  health_status: HealthStatus;
  n: number;
}

// A service ticket stored in app.service_tickets (Lakebase, owned by the app).
export interface Ticket {
  id: number;
  machine_id: string;
  title: string;
  priority: Priority;
  status: TicketStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type TicketInput = Omit<Ticket, 'id' | 'created_at' | 'updated_at'>;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
