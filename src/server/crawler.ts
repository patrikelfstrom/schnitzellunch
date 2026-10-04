import { ServiceError, fetchUpstream } from "./errors";
import { load } from "cheerio";
import { setTimeout as delay } from "node:timers/promises";
import type { CrawledRestaurant } from "../lib/types";
import type { DateFilter } from "../lib/date";
export function parseMenu(html: string, date: DateFilter): CrawledRestaurant[] {
  const $ = load(html);
  const restaurants: CrawledRestaurant[] = [];
  $("#lista .panel").each((_, panel) => {
    const title = $(".name .t_lunch", panel).text().trim();
    const contact = $(".divider .name", panel).text();
    const match = contact.match(/ADRESS:\s*(.*?)\s*TEL:\s*(.*?)(?:\s{2,}|$)/s);
    if (!title || !match) return;
    const menu = $(".rest-menu > p", panel).clone();
    menu.find("br").replaceWith("\n");
    const descriptions = menu
      .toArray()
      .flatMap((paragraph) => $(paragraph).text().split("\n"))
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => /\bschnitzel\b/i.test(line));
    if (!descriptions.length) return;
    restaurants.push({
      title,
      address: match[1].replace(/\s+/g, " ").trim(),
      phone: match[2].trim(),
      latitude: null,
      longitude: null,
      menuItems: descriptions.map((description) => ({ ...date, description })),
    });
  });
  return restaurants;
}
export async function crawlMenus(
  date: DateFilter,
  fullWeek = false,
  city = 19,
  request: typeof fetch = fetch,
) {
  const token = process.env.CRAWLER_TOKEN;
  if (!token) throw new ServiceError("configuration", "Crawler is not configured", 503);
  const restaurants: CrawledRestaurant[] = [];
  for (const weekDay of fullWeek ? [1, 2, 3, 4, 5, 6, 7] : [date.weekDay]) {
    if (fullWeek) await delay(Math.round(Math.random() * 5000));
    const proxy = new URL("https://crawler.elfstrom.io");
    proxy.searchParams.set(
      "url",
      `https://www.kvartersmenyn.se/find/_/city/${city}/day/${weekDay}`,
    );
    const response = await fetchUpstream(request, proxy, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new ServiceError("upstream", "Crawler upstream request failed", 502, response.status);
    restaurants.push(...parseMenu(await response.text(), { ...date, weekDay }));
  }
  return restaurants;
}
