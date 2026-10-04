import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { stockholmDate } from "../lib/date";
import { getRestaurants } from "../lib/restaurants";
import { getLocale, setLocale } from "../paraglide/runtime";
import * as m from "../paraglide/messages";
import RestaurantMap from "./RestaurantMap";
import RestaurantList from "./RestaurantList";
import ThemeToggle from "./ThemeToggle";
import MapBoundary from "./MapBoundary";
export default function LunchApp({
  initial,
  onWeekDayChange,
  preserveWeekDay = false,
}: {
  initial: ReturnType<typeof stockholmDate>;
  onWeekDayChange?: (day: number) => void;
  preserveWeekDay?: boolean;
}) {
  const [date, setDate] = useState(initial);
  useEffect(() => {
    setDate((current) =>
      current.year === initial.year &&
      current.week === initial.week &&
      current.weekDay === initial.weekDay
        ? current
        : { ...initial },
    );
  }, [initial.year, initial.week, initial.weekDay]);
  const [selected, setSelected] = useState<string | null>(null);
  const weekdays = useRef<HTMLElement>(null);
  useEffect(() => {
    weekdays.current
      ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [date.weekDay]);
  const query = useQuery({
    queryKey: ["restaurants", date.year, date.week, date.weekDay],
    queryFn: () => getRestaurants({ data: date }),
    retry: 1,
  });
  const restaurants = query.data ?? [];
  useEffect(() => {
    if (query.isSuccess && selected && !restaurants.some((r) => r.id === selected))
      setSelected(null);
  }, [query.data, query.isSuccess, selected]);
  // Update the ISO date after midnight without resetting the chosen weekday during the same week.
  useEffect(() => {
    const timer = setInterval(() => {
      const today = stockholmDate();
      setDate((current) =>
        current.year !== today.year || current.week !== today.week
          ? { ...today, weekDay: preserveWeekDay ? current.weekDay : today.weekDay }
          : current,
      );
    }, 60000);
    return () => clearInterval(timer);
  }, [preserveWeekDay]);
  const select = (id: string) => setSelected((current) => (current === id ? null : id));
  const days = [m.day_1, m.day_2, m.day_3, m.day_4, m.day_5, m.day_6, m.day_7];
  return (
    <main className="app">
      <MapBoundary>
        <RestaurantMap restaurants={restaurants} selected={selected} onSelect={select} />
      </MapBoundary>
      <header className="topbar">
        <div className="brand">
          <h1>Schnitzellunch.se</h1>
          <p>{m.week({ week: String(date.week) })}</p>
        </div>
        <div className="settings">
          <label className="sr-only" htmlFor="language">
            {m.language()}
          </label>
          <select
            id="language"
            className="chip"
            value={getLocale()}
            onChange={(e) => setLocale(e.target.value as "en" | "sv")}
          >
            <option value="en">English</option>
            <option value="sv">Svenska</option>
          </select>
          <ThemeToggle />
        </div>
      </header>
      <section className="panel" aria-label={m.restaurants()}>
        <nav ref={weekdays} className="weekdays" aria-label={m.days()}>
          {days.map((day, index) => (
            <button
              key={index}
              type="button"
              aria-pressed={date.weekDay === index + 1}
              className={date.weekDay === index + 1 ? "active" : ""}
              onClick={() => {
                setDate((current) => ({ ...current, weekDay: index + 1 }));
                onWeekDayChange?.(index + 1);
              }}
            >
              {day()}
            </button>
          ))}
        </nav>
        <div className="list-scroll" aria-busy={query.isFetching}>
          {query.isPending ? (
            <p className="state" role="status">
              {m.loading()}
            </p>
          ) : query.isError ? (
            <div className="state" role="alert">
              <p>{m.error()}</p>
              <button className="chip" type="button" onClick={() => query.refetch()}>
                {m.retry()}
              </button>
            </div>
          ) : restaurants.length ? (
            <RestaurantList restaurants={restaurants} selected={selected} onSelect={select} />
          ) : (
            <p className="state" role="status">
              {m.empty()}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
