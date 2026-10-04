import { createClient } from "@libsql/client";
import { Kysely } from "kysely";
import { LibSQLDialect } from "kysely-turso/libsql";
import { ServiceError } from "./errors";
import { randomUUID } from "node:crypto";
import type { Restaurant, MenuItem, RestaurantWithMenu, CrawledRestaurant } from "../lib/types";
import type { DateFilter } from "../lib/date";
export interface Database {
  Restaurant: Restaurant;
  MenuItem: MenuItem;
}
export function createDatabase(url: string, authToken?: string) {
  return new Kysely<Database>({
    dialect: new LibSQLDialect({ client: createClient({ url, authToken }) }),
  });
}
let database: Kysely<Database> | undefined;
export function getDatabase() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new ServiceError("configuration", "Database is not configured", 503);
  return (database ??= createDatabase(url, process.env.TURSO_AUTH_TOKEN));
}
export async function findRestaurants(
  db: Kysely<Database>,
  filter: DateFilter,
): Promise<RestaurantWithMenu[]> {
  const menus = await db
    .selectFrom("MenuItem")
    .selectAll()
    .where("year", "=", filter.year)
    .where("week", "=", filter.week)
    .where("weekDay", "=", filter.weekDay)
    .execute();
  if (!menus.length) return [];
  const restaurants = await db
    .selectFrom("Restaurant")
    .selectAll()
    .where(
      "id",
      "in",
      menus.map((m) => m.restaurantId),
    )
    .orderBy("title")
    .execute();
  return restaurants.map((r) => ({
    ...r,
    menuItems: menus.filter((m) => m.restaurantId === r.id),
  }));
}
export async function saveRestaurants(db: Kysely<Database>, restaurants: CrawledRestaurant[]) {
  for (const restaurant of restaurants) {
    await db.transaction().execute(async (tx) => {
      const { menuItems, ...details } = restaurant;
      const record = await tx
        .insertInto("Restaurant")
        .values({ id: randomUUID(), ...details })
        .onConflict((oc) =>
          oc
            .column("title")
            .doUpdateSet({ title: details.title, address: details.address, phone: details.phone }),
        )
        .returning("id")
        .executeTakeFirstOrThrow();
      const groups = new Map<string, typeof menuItems>();
      for (const item of menuItems) {
        const key = `${item.year}/${item.week}/${item.weekDay}`;
        groups.set(key, [...(groups.get(key) ?? []), item]);
      }
      for (const items of groups.values()) {
        const description = [...new Set(items.map((i) => i.description))].join("\n");
        await tx
          .insertInto("MenuItem")
          .values({ id: randomUUID(), ...items[0], description, restaurantId: record.id })
          .onConflict((oc) =>
            oc.columns(["weekDay", "week", "year", "restaurantId"]).doUpdateSet({ description }),
          )
          .execute();
      }
    });
  }
}
