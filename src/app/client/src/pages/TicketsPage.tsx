import { Plus, Wrench } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  PRIORITIES,
  TICKET_STATUSES,
  type Machine,
  type Priority,
  type Ticket,
  type TicketInput,
  type TicketStatus,
} from '../../../shared/types';
import { Alert, Dialog, EmptyState, PageHeader, Pill, Panel, Segmented, Skeleton } from '../components/kit';
import { api, errorMessage, toQuery } from '../lib/api';
import { formatDateTime, plural } from '../lib/format';
import { priorityTone, ticketStatusTone } from '../lib/status';
import { useFetch } from '../lib/useFetch';
import { buttonPrimary, buttonSecondary, cx, inputClass, tdClass, thClass } from '../lib/ui';

export function TicketsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const statusFilter = params.get('status') ?? '';
  // "Raise ticket" on the Fleet page opens this dialog with the machine already filled in.
  const creating = params.get('new') === '1';
  const presetMachine = params.get('machine') ?? '';

  const tickets = useFetch<Ticket[]>('/api/tickets');
  const machines = useFetch<Machine[]>('/api/fleet/machines');

  const [editing, setEditing] = useState<Ticket | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const all = tickets.data ?? [];
  const visible = statusFilter ? all.filter((t) => t.status === statusFilter) : all;
  const countOf = (status: TicketStatus) => all.filter((t) => t.status === status).length;
  const dialogOpen = creating || editing !== null;

  function setStatusFilter(value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set('status', value);
        else next.delete('status');
        return next;
      },
      { replace: true },
    );
  }

  function openNew() {
    void navigate(`/tickets?${toQuery({ new: '1', status: statusFilter })}`);
  }

  function closeDialog() {
    setEditing(null);
    setFormError(null);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('new');
        next.delete('machine');
        return next;
      },
      { replace: true },
    );
  }

  async function saveTicket(input: TicketInput) {
    const target = editing;
    setSaving(true);
    setFormError(null);
    try {
      if (target) await api.updateTicket(target.id, input);
      else await api.createTicket(input);
      closeDialog();
      tickets.reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(ticket: Ticket, status: TicketStatus) {
    setActionError(null);
    try {
      await api.updateTicket(ticket.id, { status });
      tickets.reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  async function deleteTicket(id: number) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id); // first click asks for confirmation
      return;
    }
    setActionError(null);
    try {
      await api.deleteTicket(id);
      setConfirmDeleteId(null);
      tickets.reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        title="Service tickets"
        description="Work orders for machines, raised by the service team. Stored in Lakebase and owned by this app."
        actions={
          <button type="button" onClick={openNew} className={buttonPrimary}>
            <Plus className="h-4 w-4" aria-hidden />
            New ticket
          </button>
        }
      />

      <Segmented
        label="Ticket status"
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: '', label: 'All', count: all.length },
          ...TICKET_STATUSES.map((status) => ({ value: status, label: status, count: countOf(status) })),
        ]}
      />

      {tickets.error && <Alert message={tickets.error} onRetry={tickets.reload} />}
      {actionError && <Alert message={actionError} />}

      {!tickets.data && !tickets.error && <Skeleton className="h-64 rounded-xl" />}

      {tickets.data && all.length === 0 && (
        <EmptyState icon={Wrench} title="No service tickets yet.">
          Raise one from the Fleet page, or create one here.
        </EmptyState>
      )}

      {tickets.data && all.length > 0 && visible.length === 0 && (
        <EmptyState icon={Wrench} title={`No tickets with the status “${statusFilter}”.`} />
      )}

      {tickets.data && visible.length > 0 && (
        <>
          <p className="num text-xs text-muted-foreground">
            Showing {visible.length} of {plural(all.length, 'ticket')}
          </p>
          <Panel className="overflow-x-auto p-0">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className={thClass}>ID</th>
                  <th className={thClass}>Machine</th>
                  <th className={thClass}>Title</th>
                  <th className={thClass}>Priority</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Updated</th>
                  <th className={thClass}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className={cx(tdClass, 'mono text-muted-foreground')}>#{t.id}</td>
                    <td className={cx(tdClass, 'mono')}>{t.machine_id}</td>
                    <td className={cx(tdClass, 'max-w-sm')}>
                      <div className="truncate font-medium">{t.title}</div>
                      {t.notes && <div className="truncate text-xs text-muted-foreground">{t.notes}</div>}
                    </td>
                    <td className={tdClass}>
                      <Pill tone={priorityTone[t.priority]}>{t.priority}</Pill>
                    </td>
                    <td className={tdClass}>
                      <div className="flex items-center gap-2">
                        <Pill tone={ticketStatusTone[t.status]}>{t.status}</Pill>
                        <select
                          aria-label={`Change status of ticket ${t.id}`}
                          value={t.status}
                          onChange={(event) => void changeStatus(t, event.target.value as TicketStatus)}
                          className="h-7 rounded-md border border-input bg-card px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {TICKET_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className={cx(tdClass, 'whitespace-nowrap text-xs text-muted-foreground')}>
                      {formatDateTime(t.updated_at)}
                    </td>
                    <td className={cx(tdClass, 'whitespace-nowrap text-right')}>
                      <button type="button" onClick={() => setEditing(t)} className={buttonSecondary}>
                        Edit
                      </button>{' '}
                      <button
                        type="button"
                        onClick={() => void deleteTicket(t.id)}
                        className={cx(
                          buttonSecondary,
                          'ml-1',
                          confirmDeleteId === t.id ? 'border-destructive text-destructive' : '',
                        )}
                      >
                        {confirmDeleteId === t.id ? 'Confirm delete' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}

      {dialogOpen && (
        <Dialog title={editing ? `Edit ticket #${editing.id}` : 'New service ticket'} onClose={closeDialog}>
          <TicketForm
            key={editing?.id ?? `new-${presetMachine}`}
            initial={editing ?? { machine_id: presetMachine, title: '', priority: 'Medium', status: 'Open', notes: '' }}
            machines={machines.data ?? []}
            saving={saving}
            error={formError}
            onSave={(input) => void saveTicket(input)}
            onCancel={closeDialog}
          />
        </Dialog>
      )}
    </>
  );
}

type FormValues = Omit<TicketInput, 'priority' | 'status'> & { priority: Priority; status: TicketStatus };

function TicketForm({
  initial,
  machines,
  saving,
  error,
  onSave,
  onCancel,
}: {
  initial: FormValues;
  machines: Machine[];
  saving: boolean;
  error: string | null;
  onSave: (input: TicketInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<FormValues>(initial);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      machine_id: values.machine_id.trim(),
      title: values.title.trim(),
      priority: values.priority,
      status: values.status,
      notes: values.notes,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert message={error} />}

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Machine</span>
        <input
          required
          list="machine-ids"
          value={values.machine_id}
          onChange={(e) => set('machine_id', e.target.value)}
          placeholder="For example EX-007"
          className={cx(inputClass, 'mono')}
        />
        <datalist id="machine-ids">
          {machines.map((m) => (
            <option key={m.machine_id} value={m.machine_id} label={`${m.model} · ${m.customer_name}`} />
          ))}
        </datalist>
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Title</span>
        <input
          required
          maxLength={200}
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="For example Hydraulic temperature alarm"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Priority</span>
          <select value={values.priority} onChange={(e) => set('priority', e.target.value as Priority)} className={inputClass}>
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <select value={values.status} onChange={(e) => set('status', e.target.value as TicketStatus)} className={inputClass}>
            {TICKET_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Notes</span>
        <textarea
          rows={4}
          maxLength={2000}
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className={buttonSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={buttonPrimary}>
          {saving ? 'Saving' : 'Save ticket'}
        </button>
      </div>
    </form>
  );
}
