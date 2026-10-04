import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { stockholmDate, dateFilter } from "../src/lib/date";
import { createDatabase, saveRestaurants, findRestaurants } from "../src/server/database";
import { parseMenu, crawlMenus } from "../src/server/crawler";
import { geocodeAddress, fixAddress, geocodeMissing } from "../src/server/geocoder";
import { recrawl } from "../src/server/handlers";
import { hasCoordinates } from "../src/lib/types";
const date = { year: 2026, week: 40, weekDay: 1 };
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("dates", () => {
  it("uses the Stockholm calendar date", () => {
    expect(stockholmDate(new Date("2026-10-04T22:30:00Z"))).toEqual({
      year: 2026,
      week: 41,
      weekDay: 1,
    });
  });
  it("uses the ISO year at the year boundary", () => {
    expect(stockholmDate(new Date("2021-01-01T12:00:00Z"))).toEqual({
      year: 2020,
      week: 53,
      weekDay: 5,
    });
  });
  it("rejects invalid filters", () => {
    expect(dateFilter.safeParse({ ...date, weekDay: 8 }).success).toBe(false);
    expect(dateFilter.safeParse({ ...date, week: 1.5 }).success).toBe(false);
  });
});
it("parses dishes and skips malformed panels", async () => {
  const restaurants = parseMenu(await readFile("tests/fixtures/menus.html", "utf8"), date);
  expect(restaurants).toHaveLength(1);
  expect(restaurants[0].title).toBe("Café & Lunch");
  expect(restaurants[0].menuItems).toHaveLength(2);
  expect(restaurants[0].phone).toBe("031-123456");
});
it("reports crawler upstream errors", async () => {
  vi.stubEnv("CRAWLER_TOKEN", "test");
  const request = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
  await expect(crawlMenus(date, false, 19, request)).rejects.toThrow("upstream");
  expect(request.mock.calls[0][0].searchParams.get("url")).toContain("/city/19/day/1");
});
it("rejects invalid endpoint parameters before any write", async () => {
  expect(
    (await recrawl(new Request("http://localhost/api/restaurants-recrawl?weekDay=8"))).status,
  ).toBe(400);
});
it("geocodes corrected addresses and handles missing results", async () => {
  expect(fixAddress("JA Wettergrens gata Västra Frölunda")).toBe("J A Wettergrens gata Göteborg");
  vi.stubEnv("GOOGLE_MAPS_API", "");
  expect(await geocodeAddress("Test", vi.fn().mockResolvedValue(Response.json([])))).toEqual({
    latitude: null,
    longitude: null,
  });
  expect(
    await geocodeAddress(
      "Test",
      vi.fn().mockResolvedValue(Response.json([{ lat: "57.7", lon: "11.9" }])),
    ),
  ).toEqual({ latitude: 57.7, longitude: 11.9 });
});
it("uses Google as a fallback and reports failures", async () => {
  vi.stubEnv("GOOGLE_MAPS_API", "test");
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json([]))
    .mockResolvedValueOnce(
      Response.json({
        status: "OK",
        results: [{ geometry: { location: { lat: 57, lng: 12 }, location_type: "ROOFTOP" } }],
      }),
    );
  expect(await geocodeAddress("Test", request)).toEqual({ latitude: 57, longitude: 12 });
  await expect(
    geocodeAddress("Test", vi.fn().mockResolvedValue(new Response("", { status: 500 }))),
  ).rejects.toThrow();
});
it("keeps zero coordinates and rejects missing coordinates", () => {
  const r = { id: "1", title: "Test", address: "", phone: "", latitude: 0, longitude: 0 };
  expect(hasCoordinates(r)).toBe(true);
  expect(hasCoordinates({ ...r, latitude: null })).toBe(false);
});
it("keeps schema, coordinates and IDs through repeat crawls, and filters dates", async () => {
  const directory = await mkdtemp(join(tmpdir(), "schnitzellunch-test-"));
  const url = `file:${join(directory, "test.db")}`;
  const client = createClient({ url });
  const schema = await readFile("prisma/migrations/20240307223631_init/migration.sql", "utf8");
  // Use a temporary file because libSQL transactions use a separate connection.
  const { Kysely } = await import("kysely");
  const { LibSQLDialect } = await import("kysely-turso/libsql");
  const db = new Kysely<import("../src/server/database").Database>({
    dialect: new LibSQLDialect({ client }),
  });
  try {
    await client.executeMultiple(schema);
    const rows = parseMenu(await readFile("tests/fixtures/menus.html", "utf8"), date);
    await saveRestaurants(db, rows);
    const first = await findRestaurants(db, date);
    expect(first[0].menuItems[0].description.split("\n")).toHaveLength(2);
    await db
      .updateTable("Restaurant")
      .set({ latitude: 57.7, longitude: 11.9 })
      .where("id", "=", first[0].id)
      .execute();
    await saveRestaurants(db, rows);
    const second = await findRestaurants(db, date);
    expect(second[0].id).toBe(first[0].id);
    expect(second[0].latitude).toBe(57.7);
    expect(second[0].menuItems[0].id).toBe(first[0].menuItems[0].id);
    expect(await findRestaurants(db, { ...date, weekDay: 2 })).toEqual([]);
    expect(await findRestaurants(db, { ...date, year: 2025 })).toEqual([]);
    expect(await findRestaurants(db, { ...date, week: 41 })).toEqual([]);
    await db.updateTable("Restaurant").set({ latitude: null, longitude: null }).execute();
    const request = vi.fn().mockResolvedValue(Response.json([{ lat: "57.8", lon: "12.0" }]));
    expect(await geocodeMissing(db, request)).toEqual({
      processed: 1,
      updated: 1,
      nextCursor: null,
    });
    expect((await findRestaurants(db, date))[0].latitude).toBe(57.8);
  } finally {
    await db.destroy();
    await rm(directory, { recursive: true, force: true });
  }
});
it("creates a local database client", async () => {
  const db = createDatabase("file::memory:");
  await db.destroy();
});

it("preserves separate menu paragraphs and filters unrelated dishes", async () => {
  const html = (await readFile("tests/fixtures/menus.html", "utf8")).replace(
    "Wiener schnitzel med potatis<br>Schnitzel med sås<br>Soup",
    "Wiener schnitzel med potatis</p><p>Soup</p><p>Schnitzel med sås",
  );
  expect(parseMenu(html, date)[0].menuItems.map((item) => item.description)).toEqual([
    "Wiener schnitzel med potatis",
    "Schnitzel med sås",
  ]);
});

it("validates weekday URLs", async () => {
  const { lunchSearch } = await import("../src/lib/search");
  expect(lunchSearch.parse({ day: "5" })).toEqual({ day: 5 });
  expect(lunchSearch.parse({ day: "8" })).toEqual({ day: undefined });
  expect(lunchSearch.parse({ day: "bad" })).toEqual({ day: undefined });
});
it("logs error categories without exposing messages or credentials", async () => {
  const { logServiceFailure, ServiceError } = await import("../src/server/errors");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  logServiceFailure("crawl", "menu-fetch", new ServiceError("upstream", "secret-token", 502, 503));
  expect(log).toHaveBeenCalledWith("Service operation failed", {
    operation: "crawl",
    stage: "menu-fetch",
    category: "upstream",
    upstreamStatus: 503,
  });
  logServiceFailure(
    "crawl",
    "database",
    Object.assign(new Error("private URL"), { code: "SQLITE_BUSY" }),
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain("secret-token");
  expect(JSON.stringify(log.mock.calls)).not.toContain("private URL");
  expect(log.mock.calls[1][1]).toMatchObject({ category: "database", code: "SQLITE_BUSY" });
});
it("reports missing crawler configuration with a safe error response", async () => {
  vi.stubEnv("CRAWLER_TOKEN", "");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await recrawl(new Request("http://localhost/api/restaurants-recrawl"));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Menu crawl failed" });
  expect(log.mock.calls[0][1]).toMatchObject({ category: "configuration", stage: "menu-fetch" });
});
