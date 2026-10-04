import { createServerFn } from "@tanstack/react-start";
import { dateFilter } from "./date";
export const getRestaurants = createServerFn({ method: "GET" })
  .validator(dateFilter)
  .handler(async ({ data }) => {
    const { getDatabase, findRestaurants } = await import("../server/database");
    const { logServiceFailure } = await import("../server/errors");
    try {
      return await findRestaurants(getDatabase(), data);
    } catch (error) {
      logServiceFailure("restaurants", "database", error);
      throw new Error("Could not load restaurants");
    }
  });
