// Shop hours are stored as 24-hour "HH:MM" strings in the backend.
// These helpers convert to/from a 12-hour AM/PM representation for the UI.

/** "20:00" (24h) → "8:00 PM". Returns the input unchanged if unparseable. */
export function formatTime12h(hhmm: string | null | undefined): string {
  if (!hhmm) return "";
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return hhmm;
  let h = parseInt(m[1], 10);
  const minute = m[2];
  if (h < 0 || h > 23) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${minute} ${period}`;
}

export type Period = "AM" | "PM";

/** Split a 24h "HH:MM" string into 12-hour editor parts. */
export function to12hParts(hhmm: string | null | undefined): {
  hour: string;
  minute: string;
  period: Period;
} {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? "").trim());
  let h = m ? parseInt(m[1], 10) : 8;
  const minute = m ? m[2] : "00";
  const period: Period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return { hour: String(h), minute, period };
}

/** Combine 12-hour editor parts back into a 24h "HH:MM" string, or null if invalid. */
export function from12hParts(
  hour: string,
  minute: string,
  period: Period,
): string | null {
  const h12 = parseInt(hour, 10);
  const min = parseInt(minute, 10);
  if (
    Number.isNaN(h12) ||
    Number.isNaN(min) ||
    h12 < 1 ||
    h12 > 12 ||
    min < 0 ||
    min > 59
  ) {
    return null;
  }
  let h = h12 % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
