import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/states";

export function PageContext({
  purpose,
  judgeLine,
  actor,
  related,
  label,
  children,
}: {
  purpose: string;
  judgeLine?: string;
  actor?: string;
  related?: { href: string; label: string }[];
  label?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <aside className="mb-6 rounded-xl border border-line bg-vyom-tint/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-vyom">What this screen is</p>
        {label}
      </div>
      <p className="mt-2 text-sm text-ink">{purpose}</p>
      {actor && (
        <p className="mt-2 text-sm text-ink-2">
          <span className="text-ink-3">Who acts: </span>
          {actor}
        </p>
      )}
      {judgeLine && (
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm text-ink-2">
          <span className="font-medium text-ember">Judge talking point — </span>
          {judgeLine}
        </p>
      )}
      {related && related.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="text-ink-3">Related:</span>
          {related.map((link) => (
            <Link key={link.href} className="text-vyom underline decoration-vyom/40 underline-offset-2 hover:text-ink" href={link.href}>
              {link.label}
            </Link>
          ))}
        </p>
      )}
      {children}
    </aside>
  );
}

export function SimulatedLabel() {
  return <StatusBadge tone="warn">SIMULATED / SYNTHETIC</StatusBadge>;
}
