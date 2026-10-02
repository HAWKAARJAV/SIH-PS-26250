"use client";

type Bar = { mission_id: string; tail: string; start: string; end: string; load_out: string; slot?: number };

export function Gantt({ rows, epoch, onShift }: { rows: Bar[]; epoch: string; onShift?: (row: Bar, minutes: number) => void }) {
  const start = new Date(epoch).getTime();
  const horizon = 24 * 60;
  const tails = [...new Set(rows.map((row) => row.tail))];
  if (!rows.length) return <p className="text-ink-3">All quiet on the unscheduled front.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Schedule by aircraft</caption>
        <tbody>
          {tails.map((tail) => (
            <tr key={tail} className="border-t border-line">
              <th className="w-28 p-2 font-mono">{tail}</th>
              <td className="relative h-10">
                {rows.filter((row) => row.tail === tail).map((row) => {
                  const left = ((new Date(row.start).getTime() - start) / 60000 / horizon) * 100;
                  const width = ((new Date(row.end).getTime() - new Date(row.start).getTime()) / 60000 / horizon) * 100;
                  return (
                    <button
                      type="button"
                      key={`${row.mission_id}-${row.tail}-${row.start}`}
                      className="absolute top-2 h-6 truncate rounded bg-vyom-tint px-1 text-xs leading-6 text-vyom"
                      style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(2, width)}%` }}
                      title={`${row.mission_id} ${row.load_out}`}
                      onClick={() => onShift?.(row, 15)}
                    >
                      {row.mission_id}
                    </button>
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
