import type { ReactNode } from "react";

const TONES = {
  ok: "bg-moss-tint text-moss",
  warn: "bg-amber-tint text-amber-text",
  bad: "bg-brick-tint text-brick",
  neutral: "bg-surface-2 text-ink-2",
  info: "bg-vyom-tint text-vyom",
} as const;

export function StatusBadge({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${TONES[tone]}`}>{children}</span>;
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="mt-6" role="status">
      <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-ember/70" />
      </div>
      <p className="mt-3 text-sm text-ink-3">{label}</p>
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-surface/80 px-6 py-10 text-center" role="status">
      <p className="font-display text-2xl">{title}</p>
      {detail && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-3">{detail}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mt-4 rounded-2xl border border-brick/30 bg-brick-tint px-4 py-3" role="alert">
      <p className="text-sm text-brick">{message}</p>
      {onRetry && (
        <button className="mt-2 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink hover:bg-surface-2" type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
