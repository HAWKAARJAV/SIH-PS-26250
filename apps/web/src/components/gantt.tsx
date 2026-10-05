"use client";

type Bar = { mission_id: string; tail: string; start: string; end: string; load_out: string; slot?: number };

const HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

export function Gantt({ rows, epoch, onShift }: { rows: Bar[]; epoch: string; onShift?: (row: Bar, minutes: number) => void }) {
  const start = new Date(epoch).getTime();
  const horizon = 24 * 60;
  const tails = [...new Set(rows.map((row) => row.tail))];
  if (!rows.length) return <p className="text-ink-3">All quiet on the unscheduled front.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-[var(--shadow-1)]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">Schedule by aircraft</caption>
        <tbody>
          <tr>
            <th className="w-28 p-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">Tail</th>
            <td className="relative h-7">
              {HOURS.map((hour) => (
                <span
                  key={hour}
                  className="absolute top-1 font-mono text-[10px] text-ink-3"
                  style={{ left: `${(hour / 24) * 100}%` }}
                >
                  {String(hour).padStart(2, "0")}
                </span>
              ))}
            </td>
          </tr>
          {tails.map((tail) => (
            <tr key={tail} className="border-t border-line">
              <th className="w-28 p-2 font-mono text-xs">{tail}</th>
              <td className="relative h-11 bg-[linear-gradient(to_right,transparent_0,transparent_calc(12.5%-1px),var(--color-line)_calc(12.5%-1px),var(--color-line)_12.5%,transparent_12.5%)] bg-[length:12.5%_100%]">
                {rows.filter((row) => row.tail === tail).map((row) => {
                  const left = ((new Date(row.start).getTime() - start) / 60000 / horizon) * 100;
                  const width = ((new Date(row.end).getTime() - new Date(row.start).getTime()) / 60000 / horizon) * 100;
                  const label = onShift
                    ? `Shift ${row.mission_id} on ${row.tail} 15 minutes later`
                    : `${row.mission_id} on ${row.tail}`;
                  const style = { left: `${Math.max(0, left)}%`, width: `${Math.max(2.4, width)}%` };
                  const className = "absolute top-2 h-7 truncate rounded-md bg-vyom px-1.5 text-xs leading-7 text-surface shadow-[var(--shadow-1)]";
                  return onShift ? (
                    <button
                      type="button"
                      key={`${row.mission_id}-${row.tail}-${row.start}`}
                      className={`${className} hover:bg-vyom/90`}
                      style={style}
                      title={`${row.mission_id} on ${row.tail}, load-out ${row.load_out}. Click to shift the whole mission 15 minutes later.`}
                      aria-label={label}
                      onClick={() => onShift(row, 15)}
                    >
                      {row.mission_id}
                    </button>
                  ) : (
                    <span
                      key={`${row.mission_id}-${row.tail}-${row.start}`}
                      className={className}
                      style={style}
                      title={label}
                    >
                      {row.mission_id}
                    </span>
                  );
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
