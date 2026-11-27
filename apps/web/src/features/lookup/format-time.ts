const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** `22/11/2026 14:05`, Vietnam time whatever the browser's zone. */
export function formatUpdatedAt(iso: string): string {
  const parts = new Map(PARTS.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.get(type) ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}
