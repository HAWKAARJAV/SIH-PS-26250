const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

/** Reformat a Zulu DTG (DDHHMMZ MON YY) as IST wall time, UTC+5:30. Display only. */
export function dtgToIst(dtg: string): string {
  const match = /^(\d{2})(\d{2})(\d{2})Z ([A-Z]{3}) (\d{2})$/.exec(dtg.trim());
  if (!match) return dtg;
  const day = Number(match[1]);
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const monthIndex = MONTHS.indexOf(match[4] as (typeof MONTHS)[number]);
  if (monthIndex < 0 || day < 1 || day > 31 || hour > 23 || minute > 59) return dtg;
  const year = 2000 + Number(match[5]);
  const utc = new Date(Date.UTC(year, monthIndex, day, hour, minute));
  const ist = new Date(utc.getTime() + (5 * 60 + 30) * 60_000);
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  const mon = MONTHS[ist.getUTCMonth()];
  const yy = String(ist.getUTCFullYear() % 100).padStart(2, "0");
  return `${dd}${hh}${mm} IST ${mon} ${yy}`;
}

export function clockLine(pack: string, dtg: string, seed: number, zone: "Z" | "IST") {
  const stamp = zone === "IST" ? dtgToIst(dtg) : dtg;
  return `${pack} · ${stamp} · seed ${seed}`;
}
