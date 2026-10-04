import { z } from "zod";
export const dateFilter = z.object({
  year: z.number().int().min(1900).max(9999),
  week: z.number().int().min(1).max(53),
  weekDay: z.number().int().min(1).max(7),
});
export type DateFilter = z.infer<typeof dateFilter>;
export function stockholmDate(now = new Date()): DateFilter {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) => Number(parts.find((p) => p.type === name)!.value);
  const date = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  const weekDay = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekDay);
  const year = date.getUTCFullYear();
  const week = Math.ceil(((date.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return { year, week, weekDay };
}
