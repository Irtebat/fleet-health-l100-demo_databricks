import { CircleCheck, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import type { FleetSummaryRow, HealthStatus, Machine } from '../../../shared/types';
import { Alert, EmptyState, Freshness, PageHeader, Pill, Panel, Segmented, Skeleton } from '../components/kit';
import { toQuery } from '../lib/api';
import { formatDateTime, plural } from '../lib/format';
import { useFetch } from '../lib/useFetch';
import { healthTone } from '../lib/status';
import { buttonSecondary, cx, inputClass, tdClass, thClass } from '../lib/ui';

const healthIcon: Record<HealthStatus, LucideIcon> = {
  Healthy: CircleCheck,
  Watch: TriangleAlert,
  Critical: OctagonAlert,
};

// Turns the per-region, per-status counts into totals for the KPIs and filters.
function summarize(rows: FleetSummaryRow[]) {
  const byStatus: Record<HealthStatus, number> = { Healthy: 0, Watch: 0, Critical: 0 };
  const regionTotals = new Map<string, number>();
  for (const row of rows) {
    byStatus[row.health_status] += row.n;
    regionTotals.set(row.region, (regionTotals.get(row.region) ?? 0) + row.n);
  }
  const total = byStatus.Healthy + byStatus.Watch + byStatus.Critical;
  const regions = [...regionTotals].map(([name, count]) => ({ name, count }));
  return { total, byStatus, regions };
}

export function FleetPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const region = params.get('region') ?? '';
  const status = params.get('status') ?? '';

  const machines = useFetch<Machine[]>(`/api/fleet/machines?${toQuery({ region, status })}`);
  const summary = useFetch<FleetSummaryRow[]>('/api/fleet/summary');
  const totals = summary.data ? summarize(summary.data) : null;

  // Filters live in the URL, so a filtered view can be shared or reloaded.
  function setFilter(key: 'region' | 'status', value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  function reloadAll() {
    machines.reload();
    summary.reload();
  }

  function raiseTicket(machineId: string) {
    void navigate(`/tickets?${toQuery({ new: '1', machine: machineId })}`);
  }

  const rows = machines.data ?? [];
  const refreshing = machines.refreshing || summary.refreshing;

  return (
    <>
      <PageHeader
        title="Fleet"
        description="Health of every machine, from the latest telemetry. Use the filters to find the machines that need a visit."
        actions={<Freshness updatedAt={machines.updatedAt} refreshing={refreshing} onRefresh={reloadAll} />}
      />
      <p className="-mt-4 text-xs text-muted-foreground">
        Synced from Unity Catalog <span className="mono">gold.machine_health</span>
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Machines" value={totals?.total} />
        <Kpi label="Critical" value={totals?.byStatus.Critical} tone="text-destructive" />
        <Kpi label="Watch" value={totals?.byStatus.Watch} tone="text-[#7a4f00] dark:text-amber-300" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Region"
          value={region}
          onChange={(event) => setFilter('region', event.target.value)}
          className={cx(inputClass, 'w-auto min-w-44')}
        >
          <option value="">All regions{totals ? ` (${totals.total})` : ''}</option>
          {totals?.regions.map((r) => (
            <option key={r.name} value={r.name}>
              {r.name} ({r.count})
            </option>
          ))}
        </select>
        <Segmented
          label="Health status"
          value={status}
          onChange={(value) => setFilter('status', value)}
          options={[
            { value: '', label: 'All', count: totals?.total },
            { value: 'Critical', label: 'Critical', count: totals?.byStatus.Critical },
            { value: 'Watch', label: 'Watch', count: totals?.byStatus.Watch },
            { value: 'Healthy', label: 'Healthy', count: totals?.byStatus.Healthy },
          ]}
        />
      </div>

      {machines.error && <Alert message={machines.error} onRetry={reloadAll} />}

      {!machines.data && !machines.error && <Skeleton className="h-96 rounded-xl" />}

      {machines.data && rows.length === 0 && (
        <EmptyState icon={CircleCheck} title="No machines match these filters.">
          <button
            type="button"
            className={cx(buttonSecondary, 'mt-2')}
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
          >
            Clear filters
          </button>
        </EmptyState>
      )}

      {machines.data && rows.length > 0 && (
        <>
          <p className="num text-xs text-muted-foreground">
            Showing {rows.length} of {plural(totals?.total ?? rows.length, 'machine')}
          </p>
          <Panel className="overflow-x-auto p-0">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className={thClass}>Machine</th>
                  <th className={thClass}>Model</th>
                  <th className={thClass}>Region</th>
                  <th className={thClass}>Customer</th>
                  <th className={cx(thClass, 'text-right')}>Engine hours</th>
                  <th className={cx(thClass, 'text-right')}>Hydraulic °C</th>
                  <th className={cx(thClass, 'text-right')}>Fuel %</th>
                  <th className={cx(thClass, 'text-right')}>Faults</th>
                  <th className={thClass}>Last reading</th>
                  <th className={thClass}>Health</th>
                  <th className={thClass}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const Icon = healthIcon[m.health_status];
                  return (
                    <tr key={m.machine_id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className={cx(tdClass, 'mono font-medium')}>{m.machine_id}</td>
                      <td className={tdClass}>{m.model}</td>
                      <td className={tdClass}>{m.region}</td>
                      <td className={tdClass}>{m.customer_name}</td>
                      <td className={cx(tdClass, 'num text-right')}>{m.engine_hours.toLocaleString('en-GB')}</td>
                      <td className={cx(tdClass, 'num text-right')}>{m.last_hydraulic_temp_c.toFixed(1)}</td>
                      <td className={cx(tdClass, 'num text-right')}>{m.last_fuel_pct.toFixed(0)}</td>
                      <td className={cx(tdClass, 'num text-right')}>{m.fault_count}</td>
                      <td className={cx(tdClass, 'whitespace-nowrap text-xs text-muted-foreground')}>
                        {formatDateTime(m.last_reading_at)}
                      </td>
                      <td className={tdClass}>
                        <Pill tone={healthTone[m.health_status]} icon={Icon}>
                          {m.health_status}
                        </Pill>
                      </td>
                      <td className={cx(tdClass, 'text-right')}>
                        <button
                          type="button"
                          onClick={() => raiseTicket(m.machine_id)}
                          aria-label={`Raise ticket for ${m.machine_id}`}
                          className={buttonSecondary}
                        >
                          Raise ticket
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number | undefined; tone?: string }) {
  return (
    <Panel className="py-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cx('num mt-1 text-2xl font-semibold', tone)}>
        {value === undefined ? <Skeleton className="h-7 w-14" /> : value.toLocaleString('en-GB')}
      </div>
    </Panel>
  );
}
