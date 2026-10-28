// The Ledger component kit: the few shared pieces every page is built from.
import type { LucideIcon } from 'lucide-react';
import { RefreshCw, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { formatTime } from '../lib/format';
import type { Tone } from '../lib/status';
import { buttonSecondary, cx } from '../lib/ui';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function Freshness({
  updatedAt,
  refreshing,
  onRefresh,
}: {
  updatedAt: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="num">{updatedAt ? `as of ${formatTime(updatedAt)}` : 'Loading'}</span>
      <button
        type="button"
        onClick={onRefresh}
        aria-label="Refresh"
        title="Reload the data"
        className="grid h-7 w-7 place-items-center rounded-md border border-border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RefreshCw className={cx('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden />
      </button>
    </div>
  );
}

const toneClasses: Record<Tone, string> = {
  green: 'bg-success/15 text-[#00694c] ring-success/35 dark:text-emerald-300',
  blue: 'bg-blue-500/10 text-blue-800 ring-blue-500/30 dark:text-blue-300',
  amber: 'bg-warning/20 text-[#7a4f00] ring-warning/50 dark:text-amber-300',
  red: 'bg-destructive/10 text-destructive ring-destructive/30',
  brand: 'bg-brand/10 text-brand ring-brand/30',
  neutral: 'bg-muted text-foreground ring-border',
  muted: 'bg-transparent text-muted-foreground ring-border',
};

export function Pill({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: Tone;
  icon?: LucideIcon;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        toneClasses[tone],
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('rounded-xl border border-border bg-card p-5', className)}>{children}</div>
  );
}

export function Alert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className={buttonSecondary}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-muted', className)} aria-hidden />;
}

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <Panel className="flex flex-col items-center gap-2 py-12 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </Panel>
  );
}

export function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value || 'all'}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-md px-2.5 py-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-card font-medium text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="num ml-1.5 text-xs text-muted-foreground">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
