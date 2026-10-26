import { defineDoc, section } from "@earendil-works/pi-durable";

/** The session's IANA timezone, reported by the device. A later report replaces it. */
export const TimezoneDoc = defineDoc<{ timezone?: string }>({
  kind: "app.timezone",
  version: 1,
  scope: "session",
  initial: () => ({}),
});

/** Store a timezone that `parseClientCommand` already accepted. */
export function applyTimezone(doc: { timezone?: string }, timezone: string): void {
  doc.timezone = timezone;
}

const pad = (value: number): string => String(value).padStart(2, "0");

/** `+01:00` style offset of `timezone` at `now`. */
export function utcOffset(now: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((candidate) => candidate.type === type)?.value);
  const wallClock = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
  );
  const minutes = Math.round((wallClock - Math.floor(now / 60_000) * 60_000) / 60_000);
  const sign = minutes < 0 ? "-" : "+";
  const absolute = Math.abs(minutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

/**
 * The clock line of the system prompt. Without a stored timezone the model keeps working in UTC.
 * With one, it sees local wall-clock time and the offset to put in `at` and `recurrence.timezone`.
 */
export function clockText(now: number, timezone: string | undefined): string {
  if (timezone === undefined) {
    return `Current time: ${new Date(now).toISOString().slice(0, 16)}Z. Unless the user states a timezone, treat times as UTC.`;
  }
  const offset = utcOffset(now, timezone);
  const local = new Date(now + offsetMs(offset)).toISOString().slice(0, 16).replace("T", " ");
  return (
    `Current time: ${local} in ${timezone} (UTC${offset}). ` +
    `The user's device is in ${timezone}: interpret times in it unless the user states another timezone, ` +
    `write \`at\` with the matching offset, and use ${timezone} as recurrence.timezone.`
  );
}

const offsetMs = (offset: string): number => {
  const sign = offset.startsWith("-") ? -1 : 1;
  const [hours, minutes] = offset.slice(1).split(":").map(Number);
  return sign * ((hours ?? 0) * 60 + (minutes ?? 0)) * 60_000;
};

export const clockSection = section(
  "clock",
  async (input, context) => {
    const doc = await input.read.snapshot(TimezoneDoc, context);
    const timezone = typeof doc?.timezone === "string" ? doc.timezone : undefined;
    return clockText(Date.now(), timezone);
  },
  { tag: false },
);
