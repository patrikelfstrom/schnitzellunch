import { it, expect, vi } from "vitest";
import { createClient } from "@libsql/client";
import { Kysely } from "kysely";
import { LibSQLDialect } from "kysely-turso/libsql";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "../src/server/database";
import { geocodeMissing } from "../src/server/geocoder";
vi.mock("node:timers/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:timers/promises")>();
  const delay = vi.fn(async () => {});
  return { ...actual, setTimeout: delay, default: { ...actual, setTimeout: delay } };
});
it("advances past unresolved addresses and reaches later restaurants", async () => {
  const directory = await mkdtemp(join(tmpdir(), "schnitzellunch-geocode-"));
  const client = createClient({ url: `file:${join(directory, "test.db")}` });
  const db = new Kysely<Database>({ dialect: new LibSQLDialect({ client }) });
  try {
    await client.executeMultiple(
      await readFile("prisma/migrations/20240307223631_init/migration.sql", "utf8"),
    );
    await db
      .insertInto("Restaurant")
      .values(
        Array.from({ length: 6 }, (_, i) => ({
          id: `r${i}`,
          title: `Restaurant ${i}`,
          address: `Address ${i}`,
          phone: "",
          latitude: null,
          longitude: null,
        })),
      )
      .execute();
    const request = vi
      .fn()
      .mockImplementation(async (url: URL) =>
        Response.json(url.searchParams.get("q") === "Address 5" ? [{ lat: "57", lon: "12" }] : []),
      );
    vi.stubEnv("GOOGLE_MAPS_API", "");
    const first = await geocodeMissing(db, request);
    expect(first).toEqual({ processed: 5, updated: 0, nextCursor: "r4" });
    const second = await geocodeMissing(db, request, first.nextCursor!);
    expect(second).toEqual({ processed: 1, updated: 1, nextCursor: null });
    expect(
      (
        await db
          .selectFrom("Restaurant")
          .selectAll()
          .where("id", "=", "r5")
          .executeTakeFirstOrThrow()
      ).latitude,
    ).toBe(57);
    expect(request).toHaveBeenCalledTimes(6);
  } finally {
    await db.destroy();
    await rm(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
  }
});
