import { ServiceError, fetchUpstream } from "./errors";
import { setTimeout as delay } from "node:timers/promises";
import type { Kysely } from "kysely";
import type { Database } from "./database";
export const fixAddress = (address: string) =>
  address
    .replace(/JA Wettergrens gata/i, "J A Wettergrens gata")
    .replace(/Västra Frölunda/i, "Göteborg")
    .replace(/Hisingsbacka/i, "Hisings backa")
    .replace(/Säteri allén/i, "Säteriallén")
    .replace(/Klangfärsgatan/i, "Klangfärgsgatan")
    .replace(/Krokslättsparkgata/i, "Krokslätts parkgata")
    .replace(/Hedins bilvaruhus/i, "")
    .replace(/Skandiahamnen/i, "")
    .trim();
export async function geocodeAddress(address: string, request: typeof fetch = fetch) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q: fixAddress(address),
    format: "json",
    limit: "1",
  }).toString();
  const response = await fetchUpstream(request, url, {
    headers: { "User-Agent": "Schnitzellunch/2.0 (https://schnitzellunch.se)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new ServiceError("upstream", "Geocoding upstream request failed", 502, response.status);
  const entries = (await response.json()) as { lat: string; lon: string }[];
  let latitude = entries[0] ? Number(entries[0].lat) : null;
  let longitude = entries[0] ? Number(entries[0].lon) : null;
  if (latitude === null && process.env.GOOGLE_MAPS_API) {
    const google = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    google.search = new URLSearchParams({
      address: fixAddress(address),
      key: process.env.GOOGLE_MAPS_API,
      language: "sv",
      region: "SE",
    }).toString();
    const result = await fetchUpstream(request, google, { signal: AbortSignal.timeout(10000) });
    if (!result.ok) throw new ServiceError("upstream", "Geocoding fallback failed");
    const body = (await result.json()) as {
      status: string;
      results: { geometry: { location: { lat: number; lng: number }; location_type: string } }[];
    };
    if (!["OK", "ZERO_RESULTS"].includes(body.status))
      throw new ServiceError("upstream", "Geocoding fallback failed");
    const entry =
      body.results.find((r) => r.geometry.location_type === "ROOFTOP") ?? body.results[0];
    latitude = entry?.geometry.location.lat ?? null;
    longitude = entry?.geometry.location.lng ?? null;
  }
  if (
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  )
    return { latitude, longitude };
  return { latitude: null, longitude: null };
}
// Serialize batches in this process as well as requests within each batch.
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;
export function geocodeMissing(
  db: Kysely<Database>,
  request: typeof fetch = fetch,
  cursor?: string,
  onStage: (stage: "database" | "geocode-fetch") => void = () => {},
) {
  const job = queue.then(async () => {
    onStage("database");
    let query = db
      .selectFrom("Restaurant")
      .selectAll()
      .where((eb) => eb.or([eb("latitude", "is", null), eb("longitude", "is", null)]))
      .orderBy("id");
    if (cursor) query = query.where("id", ">", cursor);
    const restaurants = await query.limit(5).execute();
    let updated = 0;
    for (const restaurant of restaurants) {
      await delay(Math.max(0, 1100 - (Date.now() - lastRequest)));
      onStage("geocode-fetch");
      const location = await geocodeAddress(restaurant.address, request).finally(() => {
        lastRequest = Date.now();
      });
      if (location.latitude !== null) {
        onStage("database");
        await db.updateTable("Restaurant").set(location).where("id", "=", restaurant.id).execute();
        updated++;
      }
    }
    return {
      processed: restaurants.length,
      updated,
      nextCursor: restaurants.length === 5 ? restaurants[restaurants.length - 1].id : null,
    };
  });
  queue = job.catch(() => {});
  return job;
}
