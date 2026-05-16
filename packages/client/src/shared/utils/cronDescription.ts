// ─── Cron description utility ─────────────────────────────────────────────────
// Supports standard 5-field cron: minute hour day month weekday

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface CronParseResult {
  valid: true;
  description: string;
}

export interface CronParseError {
  valid: false;
  error: string;
}

export type CronDescriptionResult = CronParseResult | CronParseError;

function pad(n: string): string {
  return n.padStart(2, "0");
}

function formatTime(minute: string, hour: string): string {
  return `${pad(hour)}:${pad(minute)}`;
}

function isWildcard(part: string): boolean {
  return part === "*";
}

function isStep(part: string): boolean {
  return part.includes("/");
}

function validateRange(value: string, min: number, max: number, name: string): string | null {
  const n = parseInt(value, 10);
  if (isNaN(n)) return `Invalid ${name}: '${value}'`;
  if (n < min || n > max) return `${name} must be between ${min} and ${max}`;
  return null;
}

export function parseCronDescription(expression: string): CronDescriptionResult {
  const trimmed = expression.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length !== 5) {
    return { valid: false, error: "Cron expression must have exactly 5 fields: minute hour day month weekday" };
  }

  const [minute, hour, day, month, weekday] = parts as [string, string, string, string, string];

  // Basic field-by-field validation (no lists/ranges for simplicity — extend as needed)
  for (const part of [minute, hour, day, month, weekday]) {
    if (!/^[\d*/,-]+$/.test(part)) {
      return { valid: false, error: `Invalid character in cron field: '${part}'` };
    }
  }

  // Validate concrete values
  if (!isWildcard(minute) && !isStep(minute)) {
    const err = validateRange(minute, 0, 59, "Minute");
    if (err) return { valid: false, error: err };
  }
  if (!isWildcard(hour) && !isStep(hour)) {
    const err = validateRange(hour, 0, 23, "Hour");
    if (err) return { valid: false, error: err };
  }
  if (!isWildcard(day) && !isStep(day)) {
    const err = validateRange(day, 1, 31, "Day");
    if (err) return { valid: false, error: err };
  }
  if (!isWildcard(month) && !isStep(month)) {
    const err = validateRange(month, 1, 12, "Month");
    if (err) return { valid: false, error: err };
  }
  if (!isWildcard(weekday) && !isStep(weekday)) {
    const err = validateRange(weekday, 0, 6, "Weekday");
    if (err) return { valid: false, error: err };
  }

  // Build human-readable description
  const description = buildDescription(minute, hour, day, month, weekday);
  return { valid: true, description };
}

function buildDescription(
  minute: string,
  hour: string,
  day: string,
  month: string,
  weekday: string
): string {
  // Every minute
  if (isWildcard(minute) && isWildcard(hour) && isWildcard(day) && isWildcard(month) && isWildcard(weekday)) {
    return "Every minute";
  }

  // Every N minutes: */N * * * *
  if (isStep(minute) && isWildcard(hour) && isWildcard(day) && isWildcard(month) && isWildcard(weekday)) {
    const step = minute.split("/")[1];
    return step === "1" ? "Every minute" : `Every ${step} minutes`;
  }

  // Every hour at :MM
  if (!isWildcard(minute) && isWildcard(hour) && isWildcard(day) && isWildcard(month) && isWildcard(weekday)) {
    return `Every hour at :${pad(minute)}`;
  }

  const timeStr = (!isWildcard(minute) && !isWildcard(hour))
    ? `at ${formatTime(minute, hour)}`
    : "";

  // Every day at HH:MM
  if (!isWildcard(minute) && !isWildcard(hour) && isWildcard(day) && isWildcard(month) && isWildcard(weekday)) {
    return `Every day ${timeStr}`;
  }

  // Specific weekday
  if (!isWildcard(weekday) && isWildcard(day) && isWildcard(month)) {
    const dayName = DAYS_OF_WEEK[parseInt(weekday, 10)];
    return timeStr ? `Every ${dayName} ${timeStr}` : `Every ${dayName}`;
  }

  // Specific day of month
  if (!isWildcard(day) && isWildcard(weekday) && isWildcard(month)) {
    const ordinal = ordinalSuffix(parseInt(day, 10));
    return timeStr ? `Every month on the ${ordinal} ${timeStr}` : `Every month on the ${ordinal}`;
  }

  // Specific month + day
  if (!isWildcard(month) && !isWildcard(day) && isWildcard(weekday)) {
    const monthName = MONTHS[parseInt(month, 10) - 1];
    const ordinal = ordinalSuffix(parseInt(day, 10));
    return timeStr ? `${monthName} ${ordinal} ${timeStr}` : `${monthName} ${ordinal}`;
  }

  // Fallback: reconstruct nicely
  const parts: string[] = ["At"];
  if (timeStr) parts.push(timeStr.replace("at ", ""));
  if (!isWildcard(weekday)) parts.push(`on ${DAYS_OF_WEEK[parseInt(weekday, 10)]}`);
  if (!isWildcard(day) && isWildcard(weekday)) parts.push(`on day ${day}`);
  if (!isWildcard(month)) parts.push(`in ${MONTHS[parseInt(month, 10) - 1]}`);
  return parts.join(" ");
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}
