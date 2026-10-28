// Shared class strings for the Ledger kit (kept here so components files export only components).

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const inputClass =
  'h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

export const buttonPrimary =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring';

export const buttonSecondary =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring';

export const thClass = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground';
export const tdClass = 'px-3 py-2 align-middle';
