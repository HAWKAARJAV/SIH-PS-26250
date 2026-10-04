import type { ReactNode } from "react";

const TONES = {
  ok: "bg-moss-tint text-moss",
  warn: "bg-amber-tint text-amber-text",
  bad: "bg-brick-tint text-brick",
  neutral: "bg-surface-2 text-ink-2",
  info: "bg-vyom-tint text-vyom",
} as const;

export function StatusBadge({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${TONES[tone]}`}>{children}</span>;
}

export function LoadingState({ label }: { label: string }) {
  return (
    <p className="mt-6 text-sm text-ink-3" role="status">
      {label}
    </p>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center" role="status">
      <p className="font-display text-xl">{title}</p>
      {detail && <p className="mt-2 text-sm text-ink-3">{detail}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mt-4 rounded-xl border border-brick bg-brick-tint px-4 py-3" role="alert">
      <p className="text-sm text-brick">{message}</p>
      {onRetry && (
        <button className="mt-2 rounded-lg border border-line-strong bg-surface px-3 py-1 text-sm text-ink" type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
