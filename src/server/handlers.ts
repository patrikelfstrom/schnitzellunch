import { ServiceError, logServiceFailure } from "./errors";
import { z } from "zod";
import { stockholmDate } from "../lib/date";
import { getDatabase, saveRestaurants } from "./database";
import { crawlMenus } from "./crawler";
import { geocodeMissing } from "./geocoder";
const crawlInput = z.object({
  week: z.coerce.number().int().min(1).max(53).optional(),
  weekDay: z.coerce.number().int().min(1).max(7).optional(),
  city: z.coerce.number().int().positive().optional(),
  fullWeek: z.enum(["true", "false"]).optional(),
});
export async function recrawl(request: Request) {
  const parsed = crawlInput.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Invalid crawl parameters" }, { status: 400 });
  let stage = "menu-fetch";
  try {
    const { week, weekDay, city, fullWeek } = parsed.data;
    const today = stockholmDate();
    const restaurants = await crawlMenus(
      { ...today, week: week ?? today.week, weekDay: weekDay ?? today.weekDay },
      fullWeek === "true" && weekDay === undefined,
      city,
    );
    stage = "database";
    await saveRestaurants(getDatabase(), restaurants);
    return Response.json({ status: "ok", restaurants: restaurants.length });
  } catch (error) {
    logServiceFailure("crawl", stage, error);
    return Response.json(
      { error: "Menu crawl failed" },
      { status: error instanceof ServiceError ? error.status : 500 },
    );
  }
}
const geocodeInput = z.object({
  cursor: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
});
export async function geocode(request: Request) {
  const parsed = geocodeInput.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success)
    return Response.json({ error: "Invalid geocode parameters" }, { status: 400 });
  let stage = "database";
  try {
    return Response.json({
      status: "ok",
      ...(await geocodeMissing(getDatabase(), fetch, parsed.data.cursor, (currentStage) => {
        stage = currentStage;
      })),
    });
  } catch (error) {
    logServiceFailure("geocode", stage, error);
    return Response.json(
      { error: "Geocoding failed" },
      { status: error instanceof ServiceError ? error.status : 500 },
    );
  }
}
