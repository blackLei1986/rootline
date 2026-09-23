const LEARNING_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function learningDateForTimeZone(instant: Date, timeZone: string): string {
  if (!Number.isFinite(instant.getTime())) throw new Error("Invalid learning date instant.");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function shiftLearningDate(date: string, days: number): string {
  const match = LEARNING_DATE_PATTERN.exec(date);
  if (!match || !Number.isInteger(days)) throw new Error("Invalid learning date or offset.");
  const [, year, month, day] = match;
  const instant = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (instant.toISOString().slice(0, 10) !== date) throw new Error("Invalid learning date.");
  instant.setUTCDate(instant.getUTCDate() + days);
  return instant.toISOString().slice(0, 10);
}
