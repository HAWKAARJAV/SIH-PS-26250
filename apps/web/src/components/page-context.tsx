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
    <aside className="mb-6 mt-3 max-w-4xl">
      <p className="text-sm leading-6 text-ink-2">{purpose}</p>
      {actor && <p className="mt-1 text-xs leading-5 text-ink-3">Who acts · {actor}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {label}
        {related?.map((link) => (
          <Link
            key={link.href}
            className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-2 hover:border-line-strong hover:text-ink"
            href={link.href}
          >
            {link.label}
          </Link>
        ))}
        {judgeLine && (
          <details className="rounded-full border border-ember/30 bg-ember-tint/70 px-2.5 py-1 text-xs text-ember open:rounded-xl open:px-3 open:py-2">
            <summary className="cursor-pointer list-none font-medium">For judges</summary>
            <p className="mt-2 max-w-xl font-normal leading-5 text-ink-2">{judgeLine}</p>
          </details>
        )}
      </div>
      {children}
    </aside>
  );
}

export function SimulatedLabel() {
  return <StatusBadge tone="warn">SIMULATED / SYNTHETIC</StatusBadge>;
}
